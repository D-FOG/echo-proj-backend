import type { Request, Response } from "express";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

import Invoice from "../models/Invoice";
import PaymentReceipt from "../models/PaymentReceipt";
import User from "../models/User";
import Notification from "../models/Notification";
import { env } from "../config/env";
import { createAuditLog } from "../utils/audit";
import { asyncHandler } from "../utils/async-handler";
import { ApiError } from "../utils/api-error";
import { sendMail } from "../utils/mailer";
import { uploadFile, deleteFile } from "../utils/cloudinary";

const ensureObjectId = (id: string): mongoose.Types.ObjectId => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid resource id");
  }
  return new mongoose.Types.ObjectId(id);
};

const generateInvoiceNumber = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `INV-${timestamp}-${random}`;
};

export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  const { title, description, amount, userId, dueDate, currency } = req.body as {
    title?: string;
    description?: string;
    amount?: number;
    userId?: string;
    dueDate?: string;
    currency?: string;
  };

  if (!title || amount === undefined || !userId) {
    throw new ApiError(400, "title, amount, and userId are required");
  }

  const userExists = await User.findById(ensureObjectId(userId));
  if (!userExists) {
    throw new ApiError(404, "User not found");
  }

  const invoiceNumber = generateInvoiceNumber();

  const invoice = await Invoice.create({
    invoiceNumber,
    title,
    description,
    amount,
    currency: currency || "NGN",
    user: ensureObjectId(userId),
    createdBy: req.user!.id,
    dueDate: dueDate ? new Date(dueDate) : undefined,
    status: "draft",
  });

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: "invoice.created",
    targetId: String(invoice._id),
    targetType: "Invoice",
  });

  res.status(201).json({
    success: true,
    message: "Invoice created successfully",
    data: invoice,
  });
});

export const uploadInvoiceFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ApiError(400, "No file provided");
  }

  const { invoiceId } = req.body as { invoiceId?: string };

  if (!invoiceId) {
    throw new ApiError(400, "invoiceId is required");
  }

  const invoice = await Invoice.findOne({
    _id: ensureObjectId(invoiceId),
    createdBy: req.user!.id,
  });

  if (!invoice) {
    throw new ApiError(404, "Invoice not found or not owned by you");
  }

  // Delete old file if exists
  if (invoice.invoiceFile?.publicId) {
    await deleteFile(invoice.invoiceFile.publicId);
  }

  const uploadedFile = await uploadFile(req.file.buffer, req.file.originalname, "invoices");

  invoice.invoiceFile = {
    url: uploadedFile.url,
    publicId: uploadedFile.publicId,
  };
  await invoice.save();

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: "invoice.file_uploaded",
    targetId: String(invoice._id),
    targetType: "Invoice",
  });

  res.status(200).json({
    success: true,
    message: "Invoice file uploaded successfully",
    data: invoice,
  });
});

export const sendInvoice = asyncHandler(async (req: Request, res: Response) => {
  const { invoiceId } = req.body as { invoiceId?: string };

  if (!invoiceId) {
    throw new ApiError(400, "invoiceId is required");
  }

  const invoice = await Invoice.findOne({
    _id: ensureObjectId(invoiceId),
    createdBy: req.user!.id,
    status: "draft",
  });

  if (!invoice) {
    throw new ApiError(404, "Invoice not found, not owned, or already sent");
  }

  if (!invoice.invoiceFile?.url) {
    throw new ApiError(400, "Invoice must have a file before sending");
  }

  const recipient = await User.findById(invoice.user).select("name email").lean();

  if (!recipient) {
    throw new ApiError(404, "Recipient user not found");
  }

  invoice.status = "sent";
  invoice.sentAt = new Date();
  await invoice.save();

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: "invoice.sent",
    targetId: String(invoice._id),
    targetType: "Invoice",
    metadata: { recipientEmail: recipient.email },
  });

  // Send email to user
  await sendMail({
    to: recipient.email,
    subject: `Invoice #${invoice.invoiceNumber} from Echolalax`,
    html: `<p>Hello ${recipient.name},</p>
      <p>You have received an invoice from Echolalax.</p>
      <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
      <p><strong>Title:</strong> ${invoice.title}</p>
      <p><strong>Amount:</strong> ₦${invoice.amount}</p>
      <p><strong>Due Date:</strong> ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "Not specified"}</p>
      <p>Please log in to your Echolalax dashboard to view and pay the invoice.</p>
      <p>If you have questions, contact ${env.adminSupportEmail}.</p>`,
  });

  // Create in-app notification for user
  await Notification.create({
    title: "New Invoice",
    message: `You have received an invoice #${invoice.invoiceNumber} for ₦${invoice.amount}`,
    channel: "in_app",
    audience: "all",
    createdBy: req.user!.id,
    sentAt: new Date(),
  });

  // Create notification for admin
  await Notification.create({
    title: "Invoice Sent",
    message: `Invoice #${invoice.invoiceNumber} sent to ${recipient.email}`,
    channel: "in_app",
    audience: "admins",
    createdBy: req.user!.id,
    sentAt: new Date(),
  });

  res.status(200).json({
    success: true,
    message: "Invoice sent successfully",
    data: invoice,
  });
});

export const getAdminInvoices = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    Invoice.find({ createdBy: req.user!.id })
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Invoice.countDocuments({ createdBy: req.user!.id }),
  ]);

  res.status(200).json({
    success: true,
    data: invoices,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

export const getUserInvoices = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    Invoice.find({ user: req.user!.id, status: { $in: ["sent", "paid"] } })
      .populate("createdBy", "name email")
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Invoice.countDocuments({ user: req.user!.id, status: { $in: ["sent", "paid"] } }),
  ]);

  res.status(200).json({
    success: true,
    data: invoices,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

export const getInvoiceDetail = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await Invoice.findById(ensureObjectId(req.params.id))
    .populate("user", "name email")
    .populate("createdBy", "name email");

  if (!invoice) {
    throw new ApiError(404, "Invoice not found");
  }

  const isAdmin = req.user!.role === "admin" && String(invoice.createdBy._id) === req.user!.id;
  const isUser = String(invoice.user._id) === req.user!.id;

  if (!isAdmin && !isUser) {
    throw new ApiError(403, "Not authorized to view this invoice");
  }

  res.status(200).json({
    success: true,
    data: {
      ...invoice.toObject(),
      bankDetails: isUser
        ? {
          accountName: env.bankAccountName,
          accountNumber: env.bankAccountNumber,
          bankName: env.bankName,
        }
        : undefined,
    },
  });
});

export const uploadPaymentReceipt = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ApiError(400, "No receipt file provided");
  }

  const { invoiceId } = req.body as { invoiceId?: string };

  if (!invoiceId) {
    throw new ApiError(400, "invoiceId is required");
  }

  const invoice = await Invoice.findOne({
    _id: ensureObjectId(invoiceId),
    user: req.user!.id,
    status: "sent",
    paymentStatus: "pending",
  });

  if (!invoice) {
    throw new ApiError(404, "Invoice not found or not pending payment");
  }

  const uploadedFile = await uploadFile(req.file.buffer, req.file.originalname, "receipts");

  const receipt = await PaymentReceipt.create({
    invoice: invoice._id,
    user: req.user!.id,
    receiptFile: {
      url: uploadedFile.url,
      publicId: uploadedFile.publicId,
    },
    status: "submitted",
  });

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: "user",
    action: "payment.receipt_submitted",
    targetId: String(receipt._id),
    targetType: "PaymentReceipt",
    metadata: { invoiceId: String(invoice._id) },
  });

  // Notify admin
  const admin = await User.findById(invoice.createdBy).select("email").lean();
  if (admin) {
    await sendMail({
      to: admin.email,
      subject: `Payment Receipt Submitted for Invoice #${invoice.invoiceNumber}`,
      html: `<p>A payment receipt has been submitted for invoice #${invoice.invoiceNumber}.</p>
        <p>Please review and confirm in your admin dashboard.</p>`,
    });

    await Notification.create({
      title: "Payment Receipt Received",
      message: `Receipt submitted for invoice #${invoice.invoiceNumber}`,
      channel: "in_app",
      audience: "admins",
      createdBy: req.user!.id,
      sentAt: new Date(),
    });
  }

  res.status(201).json({
    success: true,
    message: "Receipt uploaded successfully",
    data: receipt,
  });
});

export const confirmPayment = asyncHandler(async (req: Request, res: Response) => {
  const { receiptId } = req.body as { receiptId?: string };

  if (!receiptId) {
    throw new ApiError(400, "receiptId is required");
  }

  const receipt = await PaymentReceipt.findById(ensureObjectId(receiptId));

  if (!receipt) {
    throw new ApiError(404, "Receipt not found");
  }

  const invoice = await Invoice.findById(receipt.invoice);

  if (!invoice || String(invoice.createdBy) !== req.user!.id) {
    throw new ApiError(403, "Not authorized to confirm this payment");
  }

  receipt.status = "confirmed";
  receipt.confirmedBy = ensureObjectId(req.user!.id);
  receipt.confirmedAt = new Date();
  await receipt.save();

  invoice.status = "paid";
  invoice.paymentStatus = "confirmed";
  invoice.paidAt = new Date();
  await invoice.save();

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: "payment.confirmed",
    targetId: String(invoice._id),
    targetType: "Invoice",
  });

  const user = await User.findById(invoice.user).select("name email").lean();

  if (user) {
    await sendMail({
      to: user.email,
      subject: `Payment Confirmed for Invoice #${invoice.invoiceNumber}`,
      html: `<p>Hello ${user.name},</p>
        <p>Your payment for invoice #${invoice.invoiceNumber} has been confirmed.</p>
        <p>Thank you for your payment!</p>`,
    });

    await Notification.create({
      title: "Payment Confirmed",
      message: `Your payment for invoice #${invoice.invoiceNumber} has been confirmed`,
      channel: "in_app",
      audience: "all",
      createdBy: req.user!.id,
      sentAt: new Date(),
    });
  }

  res.status(200).json({
    success: true,
    message: "Payment confirmed successfully",
    data: { receipt, invoice },
  });
});

export const getPendingReceipts = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  const [receipts, total] = await Promise.all([
    PaymentReceipt.find({ status: "submitted" })
      .populate({
        path: "invoice",
        match: { createdBy: req.user!.id },
        select: "invoiceNumber amount user",
        populate: { path: "user", select: "name email" },
      })
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PaymentReceipt.countDocuments({ status: "submitted" }),
  ]);

  const filteredReceipts = receipts.filter((r) => r.invoice !== null);

  res.status(200).json({
    success: true,
    data: filteredReceipts,
    pagination: {
      page,
      limit,
      total: filteredReceipts.length,
      pages: Math.ceil(filteredReceipts.length / limit),
    },
  });
});
