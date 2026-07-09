import type { Request, Response } from "express";
import mongoose from "mongoose";

import AcademyEnrollment, { academyCourseNames } from "../models/AcademyEnrollment";
import Notification from "../models/Notification";
import User from "../models/User";
import { env } from "../config/env";
import { createAuditLog } from "../utils/audit";
import { ApiError } from "../utils/api-error";
import { asyncHandler } from "../utils/async-handler";
import { sendMail } from "../utils/mailer";
import { getPagination } from "../utils/pagination";

const nigerianPhonePattern = /^(\+234|0)[789][01]\d{8}$/;
const academyCourseSet = new Set<string>(academyCourseNames);

const ensureObjectId = (id: string): mongoose.Types.ObjectId => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid enrollment id");
  }

  return new mongoose.Types.ObjectId(id);
};

const normalizeText = (value?: string) => value?.trim();

const getApplicantName = (firstName: string, lastName: string) => `${firstName} ${lastName}`.trim();

const notifyAdminsByEmail = async (subject: string, text: string) => {
  const admins = await User.find({ role: "admin", status: "active" }).select("email").lean();
  await Promise.all(admins.map((admin) => sendMail({ to: admin.email, subject, text })));
};

export const createAcademyEnrollment = asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, email, phone, course } = req.body as {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    course?: string;
  };

  const cleanedFirstName = normalizeText(firstName);
  const cleanedLastName = normalizeText(lastName);
  const cleanedEmail = normalizeText(email)?.toLowerCase();
  const cleanedPhone = normalizeText(phone);
  const cleanedCourse = normalizeText(course);

  if (!cleanedFirstName || !cleanedLastName || !cleanedEmail || !cleanedPhone || !cleanedCourse) {
    throw new ApiError(400, "firstName, lastName, email, phone and course are required");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
    throw new ApiError(400, "A valid email is required");
  }

  if (!nigerianPhonePattern.test(cleanedPhone)) {
    throw new ApiError(400, "Use a valid Nigerian phone number, for example +2348036018329 or 08036018329");
  }

  if (!academyCourseSet.has(cleanedCourse)) {
    throw new ApiError(400, "Selected academy course is not available");
  }

  const enrollment = await AcademyEnrollment.create({
    firstName: cleanedFirstName,
    lastName: cleanedLastName,
    email: cleanedEmail,
    phone: cleanedPhone,
    course: cleanedCourse,
  });

  await createAuditLog({
    actorRole: "system",
    action: "academy.enrollment_created",
    targetId: String(enrollment._id),
    targetType: "AcademyEnrollment",
    metadata: {
      course: enrollment.course,
      email: enrollment.email,
    },
  });

  const notificationAdmin = await User.findOne({ role: "admin", status: "active" }).select("_id").lean();
  if (notificationAdmin) {
    await Notification.create({
      title: "New academy enrollment",
      message: `${getApplicantName(enrollment.firstName, enrollment.lastName)} applied for ${enrollment.course}.`,
      channel: "in_app",
      audience: "admins",
      status: "sent",
      sentAt: new Date(),
      createdBy: notificationAdmin._id,
    });
  }

  await notifyAdminsByEmail(
    `New academy enrollment: ${enrollment.course}`,
    [
      "A new academy enrollment was submitted.",
      `Applicant: ${getApplicantName(enrollment.firstName, enrollment.lastName)}`,
      `Email: ${enrollment.email}`,
      `Phone: ${enrollment.phone}`,
      `Course: ${enrollment.course}`,
      "",
      `Open admin dashboard: ${env.clientUrl}/admin/academy`,
    ].join("\n"),
  );

  await sendMail({
    to: enrollment.email,
    subject: "We received your Echolalax Academy enrollment",
    text: [
      `Hello ${enrollment.firstName},`,
      "",
      `We received your enrollment request for ${enrollment.course}.`,
      "Our academy team will review it and contact you with the next steps.",
      "",
      "Thank you for choosing Echolalax Academy.",
    ].join("\n"),
  });

  res.status(201).json({
    success: true,
    message: "Academy enrollment submitted successfully",
    data: enrollment,
  });
});

export const listAcademyEnrollments = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = getPagination(req.query.page as string, req.query.limit as string);
  const status = req.query.status as string | undefined;
  const search = normalizeText(req.query.search as string | undefined);

  const filter: Record<string, unknown> = {};

  if (status && status !== "all") {
    if (!["pending", "approved", "rejected"].includes(status)) {
      throw new ApiError(400, "status must be pending, approved, rejected or all");
    }
    filter.status = status;
  }

  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { course: { $regex: search, $options: "i" } },
    ];
  }

  const [enrollments, total] = await Promise.all([
    AcademyEnrollment.find(filter)
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AcademyEnrollment.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: enrollments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

export const updateAcademyEnrollmentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status, adminMessage } = req.body as {
    status?: "approved" | "rejected";
    adminMessage?: string;
  };

  if (!status || !["approved", "rejected"].includes(status)) {
    throw new ApiError(400, "status must be approved or rejected");
  }

  const enrollment = await AcademyEnrollment.findById(ensureObjectId(req.params.id));

  if (!enrollment) {
    throw new ApiError(404, "Academy enrollment not found");
  }

  enrollment.status = status;
  enrollment.adminMessage = normalizeText(adminMessage);
  enrollment.reviewedBy = new mongoose.Types.ObjectId(req.user!.id);
  enrollment.reviewedAt = new Date();
  await enrollment.save();

  await createAuditLog({
    actorId: req.user!.id,
    actorRole: "admin",
    action: `admin.academy_enrollment_${status}`,
    targetId: String(enrollment._id),
    targetType: "AcademyEnrollment",
    metadata: {
      course: enrollment.course,
      email: enrollment.email,
    },
  });

  const isApproved = status === "approved";
  const defaultMessage = isApproved
    ? `Your enrollment for ${enrollment.course} has been approved. Our academy team will contact you with the next steps.`
    : `Your enrollment for ${enrollment.course} was not approved at this time.`;

  await sendMail({
    to: enrollment.email,
    subject: isApproved ? "Echolalax Academy enrollment approved" : "Echolalax Academy enrollment update",
    text: [
      `Hello ${enrollment.firstName},`,
      "",
      enrollment.adminMessage || defaultMessage,
      "",
      "Regards,",
      "Echolalax Academy",
    ].join("\n"),
  });

  res.status(200).json({
    success: true,
    message: `Academy enrollment ${status} successfully`,
    data: enrollment,
  });
});
