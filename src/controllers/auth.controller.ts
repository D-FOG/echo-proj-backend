import crypto from "crypto";

import type { Request, Response } from "express";

import PasswordResetToken from "../models/PasswordResetToken";
import User from "../models/User";
import { createAuditLog } from "../utils/audit";
import { asyncHandler } from "../utils/async-handler";
import { ApiError } from "../utils/api-error";
import { signToken } from "../utils/jwt";
import { comparePassword, hashPassword } from "../utils/password";
import { sendMail } from "../utils/mailer";
import { env } from "../config/env";

const sanitizeUser = (user: Record<string, unknown>) => ({
  id: String(user._id ?? ""),
  name: String(user.name ?? ""),
  email: String(user.email ?? ""),
  phone: user.phone ? String(user.phone) : undefined,
  avatar: user.avatar ? String(user.avatar) : undefined,
  role: user.role as "user" | "admin",
  status: user.status as "active" | "suspended" | "banned",
  walletBalance: Number(user.walletBalance ?? 0),
  monthlySpend: Number(user.monthlySpend ?? 0),
  notificationPreferences: user.notificationPreferences ?? {
    emailNotifications: true,
    billingAlerts: true,
    marketingEmails: false,
  },
  createdAt: user.createdAt,
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, phone } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    phone?: string;
  };

  if (!name || !email || !password) {
    throw new ApiError(400, "name, email and password are required");
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });

  if (existingUser) {
    throw new ApiError(409, "User with this email already exists");
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password: await hashPassword(password),
    phone,
  });

  const token = signToken({
    id: String(user._id),
    role: user.role as "user" | "admin",
    tokenVersion: user.tokenVersion as number,
  });

  await createAuditLog({
    actorId: String(user._id),
    actorRole: "user",
    action: "auth.register",
    targetId: String(user._id),
    targetType: "User",
  });

  await sendMail({
    to: user.email,
    subject: "Welcome to Echolalax",
    html: `<p>Hello ${user.name},</p>
      <p>Welcome to Echolalax! Your account has been created successfully.</p>
      <p>If you did not sign up for this account, please contact <a href="mailto:${env.adminSupportEmail || "support@echolalax.com"}">${env.adminSupportEmail || "support@echolalax.com"}</a> immediately.</p>
      <p>Thank you for joining Echolalax.</p>`,
  });

  res.status(201).json({
    success: true,
    message: "Account created successfully",
    data: {
      token,
      user: sanitizeUser(user.toObject()),
    },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    throw new ApiError(400, "email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const passwordMatches = await comparePassword(password, user.password);

  if (!passwordMatches) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (user.status !== "active") {
    throw new ApiError(403, "Account is not active");
  }

  const token = signToken({
    id: String(user._id),
    role: user.role as "user" | "admin",
    tokenVersion: user.tokenVersion as number,
  });

  await createAuditLog({
    actorId: String(user._id),
    actorRole: user.role as "user" | "admin",
    action: "auth.login",
    targetId: String(user._id),
    targetType: "User",
  });

  await sendMail({
    to: user.email,
    subject: "New Echolalax sign-in detected",
    html: `<p>Hello ${user.name},</p>
      <p>We noticed a successful sign-in to your Echolalax account.</p>
      <p>If this was not you, contact <a href="mailto:${env.adminSupportEmail || "support@echolalax.com"}">${env.adminSupportEmail || "support@echolalax.com"}</a> immediately.</p>
      <p>If you want, you can change your password from your account settings.</p>`,
  });

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      token,
      user: sanitizeUser(user.toObject()),
    },
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { tokenVersion: 1 },
    });

    await createAuditLog({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: "auth.logout",
      targetId: req.user.id,
      targetType: "User",
    });
  }

  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user?.id).select("-password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json({
    success: true,
    data: sanitizeUser(user.toObject()),
  });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };

  if (!email) {
    throw new ApiError(400, "email is required");
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (user) {
    const plainToken = crypto.randomBytes(24).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(plainToken).digest("hex");

    await PasswordResetToken.findOneAndUpdate(
      { user: user._id },
      {
        user: user._id,
        token: hashedToken,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
      { upsert: true, new: true },
    );

    await createAuditLog({
      actorId: String(user._id),
      actorRole: user.role as "user" | "admin",
      action: "auth.reset_password_requested",
      targetId: String(user._id),
      targetType: "User",
      metadata: {
        resetLink: `${process.env.CLIENT_URL ?? "http://localhost:3000"}/reset-password?token=${plainToken}`,
      },
    });
  }

  res.status(200).json({
    success: true,
    message: "If that email exists, a reset link has been generated",
  });
});
