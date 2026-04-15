import type { Request, Response } from "express";
import mongoose from "mongoose";

import Automation from "../models/Automation";
import PlatformSetting from "../models/PlatformSetting";
import SupportMessage from "../models/SupportMessage";
import Transaction from "../models/Transaction";
import User from "../models/User";
import { env } from "../config/env";
import { createAuditLog } from "../utils/audit";
import { asyncHandler } from "../utils/async-handler";
import { ApiError } from "../utils/api-error";
import { sendMail } from "../utils/mailer";
import { getPagination } from "../utils/pagination";
import { comparePassword, hashPassword } from "../utils/password";

const ensureObjectId = (id: string): mongoose.Types.ObjectId => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid resource id");
  }

  return new mongoose.Types.ObjectId(id);
};

const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const addMonths = (date: Date, months: number): Date => {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
};

const getNextRunDate = (currentDate: Date, frequency: string): Date | undefined => {
  switch (frequency) {
    case "daily":
      return addDays(currentDate, 1);
    case "weekly":
      return addDays(currentDate, 7);
    case "monthly":
      return addMonths(currentDate, 1);
    case "yearly":
      return addMonths(currentDate, 12);
    default:
      return undefined;
  }
};

const getSupportRecipientEmail = async () => {
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

  conversation.messages = [];

  if (conversation.message) {
    conversation.messages = [
      {
        senderRole: "user",
        senderId: conversation.user,
        senderName: conversation.name,
        senderEmail: conversation.email,
        body: conversation.message,
        createdAt: conversation.createdAt ?? new Date(),
      },
    ];
  }

  if (conversation.replyMessage) {
    conversation.messages.push({
      senderRole: "admin",
      senderName: "Support Team",
      senderEmail: await getSupportRecipientEmail(),
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

export const getOverview = asyncHandler(async (req: Request, res: Response) => {
  const userId = ensureObjectId(req.user!.id);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const nextSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [totalAutomationsCount, activeAutomationsCount, expiringSoonCount, completedCount, successfulSpend, user] = await Promise.all([
    Automation.countDocuments({ user: userId }),
    Automation.countDocuments({ user: userId, status: "active" }),
    Automation.countDocuments({
      user: userId,
      status: "active",
      nextRunAt: { $gte: new Date(), $lte: nextSevenDays },
    }),
    Automation.countDocuments({ user: userId, status: "cancelled" }),
    Transaction.aggregate<{ total: number }>([
      {
        $match: {
          user: userId,
          type: "debit",
          status: "success",
          createdAt: { $gte: monthStart },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]),
    User.findById(userId).select("walletBalance"),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalAutomationsCount,
      activeAutomationsCount,
      expiringSoonCount,
      completedCount,
      totalMonthlySpend: successfulSpend[0]?.total ?? 0,
      walletBalance: user?.walletBalance ?? 0,
    },
  });
});

export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req.query.page as string, req.query.limit as string);
  const userId = req.user!.id;

  const [transactions, total] = await Promise.all([
    Transaction.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Transaction.countDocuments({ user: userId }),
  ]);

  res.status(200).json({
    success: true,
    data: transactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

export const fundWallet = asyncHandler(async (req: Request, res: Response) => {
  const { amount } = req.body as { amount?: number };

  if (!amount || amount <= 0) {
    throw new ApiError(400, "A valid amount is required");
  }

  const reference = `FUND-${Date.now()}`;

  const transaction = await Transaction.create({
    user: req.user!.id,
    amount,
    type: "credit",
    status: "pending",
    source: "wallet_funding",
    reference,
    description: "Wallet funding initialized",
  });

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: "user",
    action: "wallet.funding_initialized",
    targetId: String(transaction._id),
    targetType: "Transaction",
    metadata: { amount, reference },
  });

  res.status(201).json({
    success: true,
    message: "Wallet funding session initialized",
    data: {
      reference,
      provider: "paystack_or_flutterwave",
      status: transaction.status,
    },
  });
});

export const listAutomations = asyncHandler(async (req: Request, res: Response) => {
  const automations = await Automation.find({ user: req.user!.id }).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: automations,
  });
});

export const createAutomation = asyncHandler(async (req: Request, res: Response) => {
  const {
    serviceName,
    provider,
    planName,
    amount,
    frequency,
    nextRunAt,
    metadata,
  } = req.body as {
    serviceName?: string;
    provider?: string;
    planName?: string;
    amount?: number;
    frequency?: "daily" | "weekly" | "monthly" | "yearly" | "custom";
    nextRunAt?: string;
    metadata?: Record<string, unknown>;
  };

  if (!serviceName || !planName || amount === undefined) {
    throw new ApiError(400, "serviceName, planName and amount are required");
  }

  const automation = await Automation.create({
    user: req.user!.id,
    serviceName,
    provider,
    planName,
    amount,
    frequency,
    nextRunAt,
    metadata,
  });

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: "user",
    action: "automation.created",
    targetId: String(automation._id),
    targetType: "Automation",
  });

  res.status(201).json({
    success: true,
    message: "Automation created successfully",
    data: automation,
  });
});

export const updateAutomation = asyncHandler(async (req: Request, res: Response) => {
  const {
    serviceName,
    provider,
    planName,
    amount,
    frequency,
    nextRunAt,
    metadata,
    status,
  } = req.body as {
    serviceName?: string;
    provider?: string;
    planName?: string;
    amount?: number;
    frequency?: "daily" | "weekly" | "monthly" | "yearly" | "custom";
    nextRunAt?: string;
    metadata?: Record<string, unknown>;
    status?: "active" | "paused" | "cancelled";
  };

  const updates: Record<string, unknown> = Object.fromEntries(
    Object.entries({
      serviceName,
      provider,
      planName,
      amount,
      frequency,
      metadata,
      status,
    }).filter(([, value]) => value !== undefined),
  );

  if (nextRunAt !== undefined) {
    updates.nextRunAt = nextRunAt ? new Date(nextRunAt) : null;
  }

  const automation = await Automation.findOneAndUpdate(
    { _id: ensureObjectId(req.params.id), user: req.user!.id },
    updates,
    { new: true, runValidators: true },
  );

  if (!automation) {
    throw new ApiError(404, "Automation not found");
  }

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: "user",
    action: "automation.updated",
    targetId: String(automation._id),
    targetType: "Automation",
  });

  res.status(200).json({
    success: true,
    message: "Automation updated successfully",
    data: automation,
  });
});

export const getAutomation = asyncHandler(async (req: Request, res: Response) => {
  const automation = await Automation.findOne({
    _id: ensureObjectId(req.params.id),
    user: req.user!.id,
  });

  if (!automation) {
    throw new ApiError(404, "Automation not found");
  }

  res.status(200).json({
    success: true,
    data: automation,
  });
});

export const updateAutomationStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as { status?: "active" | "paused" };

  if (!status || !["active", "paused"].includes(status)) {
    throw new ApiError(400, "status must be active or paused");
  }

  const automation = await Automation.findOneAndUpdate(
    { _id: ensureObjectId(req.params.id), user: req.user!.id },
    { status },
    { new: true },
  );

  if (!automation) {
    throw new ApiError(404, "Automation not found");
  }

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: "user",
    action: "automation.status_updated",
    targetId: String(automation._id),
    targetType: "Automation",
    metadata: { status },
  });

  res.status(200).json({
    success: true,
    message: "Automation status updated",
    data: automation,
  });
});

export const deleteAutomation = asyncHandler(async (req: Request, res: Response) => {
  const automation = await Automation.findOneAndUpdate(
    { _id: ensureObjectId(req.params.id), user: req.user!.id },
    { status: "cancelled" },
    { new: true },
  );

  if (!automation) {
    throw new ApiError(404, "Automation not found");
  }

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: "user",
    action: "automation.cancelled",
    targetId: String(automation._id),
    targetType: "Automation",
  });

  res.status(200).json({
    success: true,
    message: "Automation cancelled successfully",
  });
});

export const runAutomationNow = asyncHandler(async (req: Request, res: Response) => {
  const automation = await Automation.findOne({
    _id: ensureObjectId(req.params.id),
    user: req.user!.id,
  });

  if (!automation) {
    throw new ApiError(404, "Automation not found");
  }

  const now = new Date();
  automation.lastRunAt = now;
  automation.nextRunAt = getNextRunDate(now, automation.frequency) ?? automation.nextRunAt;
  await automation.save();

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: "user",
    action: "automation.run_manually",
    targetId: String(automation._id),
    targetType: "Automation",
  });

  res.status(200).json({
    success: true,
    message: "Automation executed successfully",
    data: automation,
  });
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id).select("-password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, phone, avatar, notificationPreferences } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    notificationPreferences?: {
      emailNotifications?: boolean;
      billingAlerts?: boolean;
      marketingEmails?: boolean;
    };
  };

  if (email) {
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
      _id: { $ne: req.user!.id },
    });

    if (existingUser) {
      throw new ApiError(409, "User with this email already exists");
    }
  }

  const updates: Record<string, unknown> = Object.fromEntries(
    Object.entries({
      name,
      email: email?.toLowerCase(),
      phone,
      avatar,
      notificationPreferences,
    }).filter(([, value]) => value !== undefined),
  );

  const user = await User.findByIdAndUpdate(req.user!.id, updates, {
    new: true,
    runValidators: true,
  }).select("-password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: "user",
    action: "profile.updated",
    targetId: req.user!.id,
    targetType: "User",
  });

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: user,
  });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "currentPassword and newPassword are required");
  }

  const user = await User.findById(req.user!.id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);

  if (!isCurrentPasswordValid) {
    throw new ApiError(400, "Current password is incorrect");
  }

  user.password = await hashPassword(newPassword);
  user.tokenVersion += 1;
  await user.save();

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: "user",
    action: "password.changed",
    targetId: req.user!.id,
    targetType: "User",
  });

  res.status(200).json({
    success: true,
    message: "Password changed successfully",
  });
});

export const listSupportMessages = asyncHandler(async (req: Request, res: Response) => {
  const conversations = await SupportMessage.find({
    user: req.user!.id,
    userHiddenAt: { $exists: false },
  }).sort({ lastMessageAt: -1 });
  const normalized = await Promise.all(conversations.map((conversation) => normalizeSupportConversation(conversation)));

  res.status(200).json({
    success: true,
    data: normalized,
  });
});

export const getSupportMessage = asyncHandler(async (req: Request, res: Response) => {
  const conversation = await SupportMessage.findOne({
    _id: ensureObjectId(req.params.id),
    user: req.user!.id,
  });

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  await normalizeSupportConversation(conversation);

  res.status(200).json({
    success: true,
    data: conversation,
  });
});

export const createSupportMessage = asyncHandler(async (req: Request, res: Response) => {
  const { subject, message, urgency } = req.body as {
    subject?: string;
    message?: string;
    urgency?: "low" | "medium" | "high";
  };

  if (!subject || !message) {
    throw new ApiError(400, "subject and message are required");
  }

  const user = await User.findById(req.user!.id).select("name email");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const supportMessage = await SupportMessage.create({
    user: req.user!.id,
    name: user.name,
    email: user.email,
    subject,
    status: "open",
    urgency,
    messages: [
      {
        senderRole: "user",
        senderId: user._id,
        senderName: user.name,
        senderEmail: user.email,
        body: message,
      },
    ],
    lastMessageAt: new Date(),
  });

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: "user",
    action: "support.message_created",
    targetId: String(supportMessage._id),
    targetType: "SupportMessage",
    metadata: { urgency },
  });

  const supportRecipient = await getSupportRecipientEmail();
  if (supportRecipient) {
    await sendMail({
      to: supportRecipient,
      subject: `New support conversation: ${subject}`,
      text: [
        `A new support conversation has been created.`,
        `User: ${user.name} <${user.email}>`,
        `Urgency: ${urgency ?? "medium"}`,
        `Subject: ${subject}`,
        "",
        message,
        "",
        `Open admin dashboard: ${env.clientUrl}/admin/messages`,
      ].join("\n"),
    });
  }

  await sendMail({
    to: user.email,
    subject: `We received your support message: ${subject}`,
    text: [
      `Hello ${user.name},`,
      "",
      `We received your message and our team will reply shortly.`,
      `Subject: ${subject}`,
      "",
      message,
      "",
      `You can track the conversation here: ${env.clientUrl}/dashboard/contact`,
    ].join("\n"),
  });

  res.status(201).json({
    success: true,
    message: "Support conversation started successfully",
    data: supportMessage,
  });
});

export const replyToSupportMessage = asyncHandler(async (req: Request, res: Response) => {
  const { message } = req.body as { message?: string };

  if (!message) {
    throw new ApiError(400, "message is required");
  }

  const user = await User.findById(req.user!.id).select("name email");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const conversation = await SupportMessage.findOne({
    _id: ensureObjectId(req.params.id),
    user: req.user!.id,
    userHiddenAt: { $exists: false },
  });

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  await normalizeSupportConversation(conversation);

  conversation.messages.push({
    senderRole: "user",
    senderId: user._id,
    senderName: user.name,
    senderEmail: user.email,
    body: message,
    createdAt: new Date(),
  });
  conversation.status = "open";
  conversation.lastMessageAt = new Date();
  conversation.adminCompletionRequestedAt = undefined;
  await conversation.save();

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: "user",
    action: "support.message_replied",
    targetId: String(conversation._id),
    targetType: "SupportMessage",
  });

  const supportRecipient = await getSupportRecipientEmail();
  if (supportRecipient) {
    await sendMail({
      to: supportRecipient,
      subject: `New user reply on: ${conversation.subject}`,
      text: [
        `The user replied to an existing support conversation.`,
        `User: ${user.name} <${user.email}>`,
        `Subject: ${conversation.subject}`,
        "",
        message,
        "",
        `Open admin dashboard: ${env.clientUrl}/admin/messages`,
      ].join("\n"),
    });
  }

  res.status(200).json({
    success: true,
    message: "Reply sent successfully",
    data: conversation,
  });
});

export const completeSupportMessage = asyncHandler(async (req: Request, res: Response) => {
  const conversation = await SupportMessage.findOne({
    _id: ensureObjectId(req.params.id),
    user: req.user!.id,
    userHiddenAt: { $exists: false },
  });

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  await normalizeSupportConversation(conversation);

  if (conversation.status !== "awaiting_user_confirmation") {
    throw new ApiError(400, "This conversation is not awaiting your completion confirmation");
  }

  const now = new Date();
  conversation.status = "completed";
  conversation.completedAt = now;
  conversation.userHiddenAt = now;
  await conversation.save();

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: "user",
    action: "support.message_completed",
    targetId: String(conversation._id),
    targetType: "SupportMessage",
  });

  const supportRecipient = await getSupportRecipientEmail();
  if (supportRecipient) {
    await sendMail({
      to: supportRecipient,
      subject: `Conversation completed by user: ${conversation.subject}`,
      text: [
        `The user marked this support conversation as completed.`,
        `User: ${conversation.name} <${conversation.email}>`,
        `Subject: ${conversation.subject}`,
        `Completed at: ${now.toISOString()}`,
        "",
        `Open admin dashboard: ${env.clientUrl}/admin/messages`,
      ].join("\n"),
    });
  }

  await sendMail({
    to: conversation.email,
    subject: `Support conversation completed: ${conversation.subject}`,
    text: [
      `Hello ${conversation.name},`,
      "",
      `Thanks for confirming that this support conversation has been completed.`,
      `Subject: ${conversation.subject}`,
      "",
      `If you need more help, you can start a new conversation anytime from ${env.clientUrl}/dashboard/contact`,
    ].join("\n"),
  });

  res.status(200).json({
    success: true,
    message: "Conversation completed successfully",
    data: conversation,
  });
});
