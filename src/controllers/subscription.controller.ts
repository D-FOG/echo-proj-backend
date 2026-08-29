import type { Request, Response } from "express";
import mongoose from "mongoose";

import Subscription from "../models/Subscription";
import RenewalRequest from "../models/RenewalRequest";
import { asyncHandler } from "../utils/async-handler";
import { ApiError } from "../utils/api-error";
import { getPagination } from "../utils/pagination";
import { addMonths, getRemainingDays, getSubscriptionStatus, type SubscriptionStatus } from "../utils/subscription-status";
import { createAuditLog } from "../utils/audit";

type SubscriptionInput = {
  customerId?: string;
  customerName?: string;
  categoryName?: string;
  iucNumber?: string;
  tagId?: string;
  serialNumber?: string;
  model?: string;
  provider?: string;
  bouquet?: string;
  startDate?: string;
  endDate?: string;
  durationDays?: number;
  durationMonths?: number;
  lifecycleStatus?: "pending" | "active";
  notes?: string;
};

const ensureDate = (value: string | undefined, field: string): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, `${field} must be a valid date`);
  return date;
};

const serializeSubscription = (subscription: any, now = new Date()) => {
  const item = subscription.toObject ? subscription.toObject() : subscription;
  const endDate = new Date(item.endDate);
  const lifecycleStatus = item.lifecycleStatus ?? "active";
  return {
    ...item,
    categoryName: item.categoryName || "General",
    lifecycleStatus,
    remainingDays: lifecycleStatus === "pending" ? 0 : getRemainingDays(endDate, now),
    status: lifecycleStatus === "pending" ? "pending" : getSubscriptionStatus(endDate, now),
  };
};

const getEndDate = (input: SubscriptionInput, startDate: Date, required: boolean): Date | undefined => {
  if (input.durationDays !== undefined && input.durationMonths !== undefined) {
    throw new ApiError(400, "Provide either durationDays or durationMonths, not both");
  }
  const manualEndDate = ensureDate(input.endDate, "endDate");
  if (manualEndDate) return manualEndDate;
  if (input.durationDays !== undefined) {
    if (!Number.isInteger(input.durationDays) || input.durationDays < 1) throw new ApiError(400, "durationDays must be a positive whole number");
    return new Date(startDate.getTime() + input.durationDays * 24 * 60 * 60 * 1000);
  }
  if (input.durationMonths !== undefined) {
    if (!Number.isInteger(input.durationMonths) || input.durationMonths < 1) throw new ApiError(400, "durationMonths must be a positive whole number");
    return addMonths(startDate, input.durationMonths);
  }
  if (required) throw new ApiError(400, "endDate, durationDays, or durationMonths is required");
  return undefined;
};

const validateRange = (startDate: Date, endDate: Date) => {
  if (endDate.getTime() <= startDate.getTime()) throw new ApiError(400, "endDate must be after startDate");
};

export const createSubscription = asyncHandler(async (req: Request, res: Response) => {
  const inputs = Array.isArray(req.body) ? req.body : [req.body];
  if (inputs.length === 0) throw new ApiError(400, "Provide at least one subscription");

  const subscriptionsToCreate = inputs.map((rawInput, index) => {
    if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
      throw new ApiError(400, `Subscription ${index + 1} must be a JSON object`);
    }
    const input = rawInput as SubscriptionInput;
    try {
      if (!input.iucNumber?.trim()) throw new ApiError(400, "iucNumber is required");
      if (!input.startDate) throw new ApiError(400, "startDate is required");
      if (input.durationDays === undefined) throw new ApiError(400, "durationDays is required");
      if (input.durationMonths !== undefined || input.endDate !== undefined) throw new ApiError(400, "Use durationDays when creating a subscription");
      if (input.customerId && !mongoose.Types.ObjectId.isValid(input.customerId)) throw new ApiError(400, "customerId is invalid");
      if (input.lifecycleStatus && !["pending", "active"].includes(input.lifecycleStatus)) throw new ApiError(400, "lifecycleStatus must be pending or active");

      const startDate = ensureDate(input.startDate, "startDate")!;
      const endDate = getEndDate(input, startDate, true)!;
      validateRange(startDate, endDate);
      return {
        customer: input.customerId,
        customerName: input.customerName,
        categoryName: input.categoryName?.trim() || "General",
        iucNumber: input.iucNumber.trim(),
        tagId: input.tagId,
        serialNumber: input.serialNumber,
        model: input.model,
        provider: input.provider,
        bouquet: input.bouquet,
        startDate,
        endDate,
        durationDays: input.durationDays,
        lifecycleStatus: input.lifecycleStatus ?? "active",
        notes: input.notes,
        createdBy: req.user!.id,
      };
    } catch (error) {
      if (error instanceof ApiError) throw new ApiError(error.statusCode, `Subscription ${index + 1}: ${error.message}`);
      throw error;
    }
  });

  const subscriptions = await Subscription.create(subscriptionsToCreate);
  await Promise.all(subscriptions.map((subscription) => createAuditLog({
    actorId: req.user!.id,
    actorRole: "admin",
    action: "subscription.created",
    targetId: String(subscription._id),
    targetType: "Subscription",
  })));

  const isBatch = Array.isArray(req.body);
  res.status(201).json({
    success: true,
    message: isBatch ? `${subscriptions.length} subscriptions created successfully` : "Subscription created successfully",
    uploadedCount: subscriptions.length,
    data: isBatch ? subscriptions.map((subscription) => serializeSubscription(subscription)) : serializeSubscription(subscriptions[0]),
  });
});

export const listSubscriptions = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req.query.page as string, req.query.limit as string);
  const search = (req.query.search as string | undefined)?.trim();
  const provider = (req.query.provider as string | undefined)?.trim();
  const categoryName = (req.query.categoryName as string | undefined)?.trim();
  const status = req.query.status as SubscriptionStatus | "pending" | undefined;
  const filter: Record<string, any> = {};
  if (provider) filter.provider = { $regex: `^${provider.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" };
  if (categoryName) filter.categoryName = { $regex: `^${categoryName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" };
  if (search) filter.$or = [
    { customerName: { $regex: search, $options: "i" } },
    { iucNumber: { $regex: search, $options: "i" } },
    { tagId: { $regex: search, $options: "i" } },
    { serialNumber: { $regex: search, $options: "i" } },
    { model: { $regex: search, $options: "i" } },
  ];
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  if (status === "pending") filter.lifecycleStatus = "pending";
  if (status === "expired") Object.assign(filter, { lifecycleStatus: { $ne: "pending" }, endDate: { $lt: now } });
  if (status === "expiring_soon") Object.assign(filter, { lifecycleStatus: { $ne: "pending" }, endDate: { $gte: now, $lte: new Date(now.getTime() + 5 * day) } });
  if (status === "warning") Object.assign(filter, { lifecycleStatus: { $ne: "pending" }, endDate: { $gt: new Date(now.getTime() + 5 * day), $lte: new Date(now.getTime() + 15 * day) } });
  if (status === "active") Object.assign(filter, { lifecycleStatus: { $ne: "pending" }, endDate: { $gt: new Date(now.getTime() + 15 * day) } });
  if (status && !["active", "warning", "expiring_soon", "expired", "pending"].includes(status)) throw new ApiError(400, "Invalid status filter");

  const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;
  const [subscriptions, total] = await Promise.all([
    Subscription.find(filter).populate("customer", "name email").populate("createdBy", "name email").sort({ endDate: sortOrder }).skip(skip).limit(limit),
    Subscription.countDocuments(filter),
  ]);
  res.status(200).json({ success: true, data: subscriptions.map((item) => serializeSubscription(item, now)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const getSubscription = asyncHandler(async (req: Request, res: Response) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid subscription id");
  const subscription = await Subscription.findById(req.params.id).populate("customer", "name email").populate("createdBy", "name email");
  if (!subscription) throw new ApiError(404, "Subscription not found");
  res.status(200).json({ success: true, data: serializeSubscription(subscription) });
});

export const updateSubscription = asyncHandler(async (req: Request, res: Response) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid subscription id");
  const subscription = await Subscription.findById(req.params.id);
  if (!subscription) throw new ApiError(404, "Subscription not found");
  const input = req.body as SubscriptionInput;
  if (input.customerId !== undefined && (!input.customerId || !mongoose.Types.ObjectId.isValid(input.customerId))) throw new ApiError(400, "customerId is invalid");
  if (input.lifecycleStatus && !["pending", "active"].includes(input.lifecycleStatus)) throw new ApiError(400, "lifecycleStatus must be pending or active");
  const startDate = ensureDate(input.startDate, "startDate") ?? subscription.startDate;
  const recalculatedEndDate = getEndDate(input, startDate, false);
  const endDate = recalculatedEndDate ?? subscription.endDate;
  validateRange(startDate, endDate);
  const fields: Array<keyof SubscriptionInput> = ["customerName", "categoryName", "iucNumber", "tagId", "serialNumber", "model", "provider", "bouquet", "notes", "durationDays", "durationMonths", "lifecycleStatus"];
  fields.forEach((field) => { if (input[field] !== undefined) (subscription as any)[field] = input[field]; });
  if (input.endDate !== undefined) {
    subscription.durationDays = undefined;
    subscription.durationMonths = undefined;
  } else if (input.durationDays !== undefined) {
    subscription.durationMonths = undefined;
  } else if (input.durationMonths !== undefined) {
    subscription.durationDays = undefined;
  }
  if (input.customerId !== undefined) subscription.customer = new mongoose.Types.ObjectId(input.customerId);
  subscription.startDate = startDate;
  subscription.endDate = endDate;
  await subscription.save();
  await createAuditLog({ actorId: req.user!.id, actorRole: "admin", action: "subscription.updated", targetId: String(subscription._id), targetType: "Subscription" });
  res.status(200).json({ success: true, message: "Subscription updated successfully", data: serializeSubscription(subscription) });
});

export const deleteSubscription = asyncHandler(async (req: Request, res: Response) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid subscription id");
  const subscription = await Subscription.findByIdAndDelete(req.params.id);
  if (!subscription) throw new ApiError(404, "Subscription not found");
  await createAuditLog({ actorId: req.user!.id, actorRole: "admin", action: "subscription.deleted", targetId: String(subscription._id), targetType: "Subscription" });
  res.status(200).json({ success: true, message: "Subscription deleted successfully", data: null });
});

export const getSubscriptionSummary = asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const [active, expiringSoon, expired, pending, recentlyAdded] = await Promise.all([
    Subscription.countDocuments({ lifecycleStatus: { $ne: "pending" }, endDate: { $gt: new Date(now.getTime() + 15 * day) } }),
    Subscription.countDocuments({ lifecycleStatus: { $ne: "pending" }, endDate: { $gte: now, $lte: new Date(now.getTime() + 5 * day) } }),
    Subscription.countDocuments({ lifecycleStatus: { $ne: "pending" }, endDate: { $lt: now } }),
    Subscription.countDocuments({ lifecycleStatus: "pending" }),
    Subscription.find().populate("customer", "name email").populate("createdBy", "name email").sort({ createdAt: -1 }).limit(5),
  ]);
  res.status(200).json({ success: true, data: { active, expiringSoon, expired, pending, recentlyAdded: recentlyAdded.map((item) => serializeSubscription(item, now)) } });
});

export const listRenewalRequests = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req.query.page as string, req.query.limit as string);
  const status = req.query.status as string | undefined;
  const filter = status ? { status } : {};
  if (status && !["pending", "approved", "completed", "rejected"].includes(status)) throw new ApiError(400, "Invalid renewal request status");
  const [requests, total] = await Promise.all([
    RenewalRequest.find(filter).populate("subscription", "customerName categoryName iucNumber provider bouquet lifecycleStatus endDate").populate("user", "name email phone").populate("reviewedBy", "name email").sort({ createdAt: -1 }).skip(skip).limit(limit),
    RenewalRequest.countDocuments(filter),
  ]);
  res.status(200).json({ success: true, data: requests, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const updateRenewalRequest = asyncHandler(async (req: Request, res: Response) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid renewal request id");
  const status = req.body.status as string | undefined;
  if (!status || !["approved", "completed", "rejected"].includes(status)) throw new ApiError(400, "status must be approved, completed, or rejected");
  const request = await RenewalRequest.findById(req.params.id);
  if (!request) throw new ApiError(404, "Renewal request not found");
  request.status = status as "approved" | "completed" | "rejected";
  request.reviewedBy = new mongoose.Types.ObjectId(req.user!.id);
  request.reviewedAt = new Date();
  await request.save();
  await createAuditLog({ actorId: req.user!.id, actorRole: "admin", action: `subscription.renewal_${status}`, targetId: String(request._id), targetType: "RenewalRequest" });
  res.status(200).json({ success: true, message: "Renewal request updated successfully", data: request });
});
