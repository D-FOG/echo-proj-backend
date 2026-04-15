import type { Request, Response } from "express";
import mongoose from "mongoose";

import Automation from "../models/Automation";
import AuditLog from "../models/AuditLog";
import Notification from "../models/Notification";
import PlatformSetting from "../models/PlatformSetting";
import SupportMessage from "../models/SupportMessage";
import User from "../models/User";
import { env } from "../config/env";
import { createAuditLog } from "../utils/audit";
import { asyncHandler } from "../utils/async-handler";
import { ApiError } from "../utils/api-error";
import { sendMail } from "../utils/mailer";
import { getPagination } from "../utils/pagination";

const ensureObjectId = (id: string): mongoose.Types.ObjectId => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid resource id");
  }

  return new mongoose.Types.ObjectId(id);
};

const getSupportMailbox = async () => {
  const settings = await PlatformSetting.findOne().select("supportEmail");
  return settings?.supportEmail || env.adminSupportEmail || env.mailFrom;
};

const normalizeSupportConversation = async (conversation: any) => {
  if (!conversation) {
    return conversation;
  }

  const hasMessages = Array.isArray(conversation.messages) && conversation.messages.length > 0;
  if (hasMessages) {
    return conversation;
  }

  const supportMailbox = await getSupportMailbox();
  conversation.messages = [];

  if (conversation.message) {
    conversation.messages.push({
      senderRole: "user",
      senderId: conversation.user,
      senderName: conversation.name,
      senderEmail: conversation.email,
      body: conversation.message,
      createdAt: conversation.createdAt ?? new Date(),
    });
  }

  if (conversation.replyMessage) {
    conversation.messages.push({
      senderRole: "admin",
      senderName: "Support Team",
      senderEmail: supportMailbox,
      body: conversation.replyMessage,
      createdAt: conversation.repliedAt ?? conversation.updatedAt ?? new Date(),
    });
  }

  if (conversation.status === "resolved") {
    conversation.status = "awaiting_user_confirmation";
    conversation.adminCompletionRequestedAt = conversation.resolvedAt ?? conversation.updatedAt ?? new Date();
  } else if (conversation.replyMessage) {
    conversation.status = "admin_replied";
  } else {
    conversation.status = "open";
  }

  conversation.lastMessageAt =
    conversation.messages[conversation.messages.length - 1]?.createdAt ?? conversation.createdAt ?? new Date();
  conversation.message = undefined;
  conversation.replyMessage = undefined;
  await conversation.save();

  return conversation;
};

export const getAdminOverview = asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();
  const nextSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [totalUsers, totalAutomations, expiringSoon, activeAutomations] = await Promise.all([
    User.countDocuments({ role: "user" }),
    Automation.countDocuments(),
    Automation.countDocuments({
      status: "active",
      nextRunAt: { $gte: now, $lte: nextSevenDays },
    }),
    Automation.countDocuments({ status: "active" }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalUsers,
      totalAutomations,
      expiringSoon,
      activeAutomations,
    },
  });
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req.query.page as string, req.query.limit as string);
  const search = (req.query.search as string | undefined)?.trim();

  const filter = search
    ? {
        role: "user",
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ],
      }
    : { role: "user" };

  const [users, total] = await Promise.all([
    User.find(filter).select("-password").sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

export const getUserDetails = asyncHandler(async (req: Request, res: Response) => {
  const userId = ensureObjectId(req.params.id);

  const [user, automations] = await Promise.all([
    User.findById(userId).select("-password"),
    Automation.find({ user: userId }).sort({ createdAt: -1 }),
  ]);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json({
    success: true,
    data: {
      user,
      walletBalance: user.walletBalance,
      automations,
    },
  });
});

export const updateUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as { status?: "active" | "suspended" | "banned" };

  if (!status || !["active", "suspended", "banned"].includes(status)) {
    throw new ApiError(400, "status must be active, suspended or banned");
  }

  const user = await User.findByIdAndUpdate(
    ensureObjectId(req.params.id),
    { status },
    { new: true },
  ).select("-password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: "admin",
    action: "admin.user_status_updated",
    targetId: String(user._id),
    targetType: "User",
    metadata: { status },
  });

  res.status(200).json({
    success: true,
    message: "User status updated successfully",
    data: user,
  });
});

export const listPlatformAutomations = asyncHandler(async (req: Request, res: Response) => {
  const service = req.query.service as string | undefined;
  const status = req.query.status as string | undefined;

  const filter: Record<string, unknown> = {};

  if (service) {
    filter.serviceName = { $regex: service, $options: "i" };
  }

  if (status) {
    filter.status = status;
  }

  const automations = await Automation.find(filter)
    .populate("user", "name email")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: automations,
  });
});

export const listMessages = asyncHandler(async (_req: Request, res: Response) => {
  const messages = await SupportMessage.find()
    .populate("user", "name email")
    .sort({ lastMessageAt: -1 });
  const normalized = await Promise.all(messages.map((message) => normalizeSupportConversation(message)));

  res.status(200).json({
    success: true,
    data: normalized,
  });
});

export const getMessageDetails = asyncHandler(async (req: Request, res: Response) => {
  const message = await SupportMessage.findById(ensureObjectId(req.params.id)).populate("user", "name email");

  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  await normalizeSupportConversation(message);

  res.status(200).json({
    success: true,
    data: message,
  });
});

export const resolveMessage = asyncHandler(async (req: Request, res: Response) => {
  const message = await SupportMessage.findById(ensureObjectId(req.params.id));

  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  await normalizeSupportConversation(message);

  const now = new Date();
  message.status = "awaiting_user_confirmation";
  message.adminCompletionRequestedAt = now;
  await message.save();

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: "admin",
    action: "admin.message_completion_requested",
    targetId: String(message._id),
    targetType: "SupportMessage",
  });

  await sendMail({
    to: message.email,
    subject: `Please confirm completion: ${message.subject}`,
    text: [
      `Hello ${message.name},`,
      "",
      `Our support team believes this conversation has been handled.`,
      `Please open your dashboard and click completed if everything is resolved.`,
      `Subject: ${message.subject}`,
      "",
      `Dashboard link: ${env.clientUrl}/dashboard/contact`,
    ].join("\n"),
  });

  res.status(200).json({
    success: true,
    message: "Completion request sent to user",
    data: message,
  });
});

export const replyToMessage = asyncHandler(async (req: Request, res: Response) => {
  const { replyMessage } = req.body as { replyMessage?: string };

  if (!replyMessage) {
    throw new ApiError(400, "replyMessage is required");
  }

  const admin = await User.findById(req.user!.id).select("name email");
  if (!admin) {
    throw new ApiError(404, "Admin not found");
  }

  const message = await SupportMessage.findById(ensureObjectId(req.params.id));

  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  await normalizeSupportConversation(message);

  message.messages.push({
    senderRole: "admin",
    senderId: admin._id,
    senderName: admin.name,
    senderEmail: admin.email,
    body: replyMessage,
    createdAt: new Date(),
  });
  message.status = "admin_replied";
  message.repliedAt = new Date();
  message.lastMessageAt = new Date();
  message.adminCompletionRequestedAt = undefined;
  await message.save();

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: "admin",
    action: "admin.message_replied",
    targetId: String(message._id),
    targetType: "SupportMessage",
  });

  await sendMail({
    to: message.email,
    subject: `Support reply: ${message.subject}`,
    text: [
      `Hello ${message.name},`,
      "",
      `Our support team replied to your conversation.`,
      `Subject: ${message.subject}`,
      "",
      replyMessage,
      "",
      `View the full conversation: ${env.clientUrl}/dashboard/contact`,
    ].join("\n"),
  });

  res.status(200).json({
    success: true,
    message: "Reply recorded successfully",
    data: message,
  });
});

export const listLogs = asyncHandler(async (_req: Request, res: Response) => {
  const req = _req;
  const { page, limit, skip } = getPagination(req.query.page as string, req.query.limit as string);
  const search = (req.query.search as string | undefined)?.trim();
  const sortBy = (req.query.sortBy as string | undefined) ?? "createdAt";
  const sortOrder = (req.query.sortOrder as string | undefined)?.toLowerCase() === "asc" ? 1 : -1;

  const filter: Record<string, unknown> = {};

  if (search) {
    const actorMatches = await User.find({
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    }).select("_id");

    const actorIds = actorMatches.map((user) => user._id);

    filter.$or = [
      { action: { $regex: search, $options: "i" } },
      { actorRole: { $regex: search, $options: "i" } },
      { targetType: { $regex: search, $options: "i" } },
      { targetId: mongoose.Types.ObjectId.isValid(search) ? new mongoose.Types.ObjectId(search) : null },
      ...(actorIds.length > 0 ? [{ actorId: { $in: actorIds } }] : []),
    ].filter(Boolean);
  }

  const allowedSortFields = new Set(["createdAt", "action", "actorRole", "targetType"]);
  const resolvedSortBy = allowedSortFields.has(sortBy) ? sortBy : "createdAt";

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("actorId", "name email")
      .sort({ [resolvedSortBy]: sortOrder })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  let settings = await PlatformSetting.findOne();

  if (!settings) {
    settings = await PlatformSetting.create({});
  }

  res.status(200).json({
    success: true,
    data: settings,
  });
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await PlatformSetting.findOneAndUpdate({}, req.body, {
    new: true,
    upsert: true,
    runValidators: true,
  });

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: "admin",
    action: "admin.settings_updated",
    targetType: "PlatformSetting",
    metadata: req.body as Record<string, unknown>,
  });

  res.status(200).json({
    success: true,
    message: "Settings updated successfully",
    data: settings,
  });
});

export const listNotifications = asyncHandler(async (_req: Request, res: Response) => {
  const req = _req;
  const { page, limit, skip } = getPagination(req.query.page as string, req.query.limit as string);
  const search = (req.query.search as string | undefined)?.trim();
  const sortBy = (req.query.sortBy as string | undefined) ?? "createdAt";
  const sortOrder = (req.query.sortOrder as string | undefined)?.toLowerCase() === "asc" ? 1 : -1;

  const filter: Record<string, unknown> = {};

  if (search) {
    const creatorMatches = await User.find({
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    }).select("_id");

    const creatorIds = creatorMatches.map((user) => user._id);

    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { message: { $regex: search, $options: "i" } },
      { channel: { $regex: search, $options: "i" } },
      { audience: { $regex: search, $options: "i" } },
      { status: { $regex: search, $options: "i" } },
      ...(creatorIds.length > 0 ? [{ createdBy: { $in: creatorIds } }] : []),
    ];
  }

  const allowedSortFields = new Set(["createdAt", "title", "audience", "channel", "status", "sentAt"]);
  const resolvedSortBy = allowedSortFields.has(sortBy) ? sortBy : "createdAt";

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .populate("createdBy", "name email")
      .sort({ [resolvedSortBy]: sortOrder })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: notifications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

export const createNotification = asyncHandler(async (req: Request, res: Response) => {
  const { title, message, channel, audience, status } = req.body as {
    title?: string;
    message?: string;
    channel?: "email" | "push" | "in_app";
    audience?: "all" | "users" | "admins";
    status?: "draft" | "sent";
  };

  if (!title || !message || !channel) {
    throw new ApiError(400, "title, message and channel are required");
  }

  const resolvedStatus = status === "draft" ? "draft" : "sent";

  const notification = await Notification.create({
    title,
    message,
    channel,
    audience,
    status: resolvedStatus,
    sentAt: resolvedStatus === "sent" ? new Date() : undefined,
    createdBy: req.user!.id,
  });

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: "admin",
    action: "admin.notification_created",
    targetId: String(notification._id),
    targetType: "Notification",
  });

  res.status(201).json({
    success: true,
    message: resolvedStatus === "draft" ? "Broadcast saved as draft" : "Broadcast created successfully",
    data: notification,
  });
});
