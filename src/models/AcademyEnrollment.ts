import { Schema, model } from "mongoose";

export const academyCourseNames = [
  "Structured office LAN cabling",
  "CCTV",
  "FIBRE OPTICS",
  "LV ELECTRICAL wiring",
  "Intercom",
  "Any kind of cabling",
  "Radio Frequency and Mototrbo",
  "Automation",
  "Embedded Systems",
  "Artificial Intelligence",
] as const;

const academyEnrollmentSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    course: {
      type: String,
      enum: academyCourseNames,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    adminMessage: {
      type: String,
      trim: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

academyEnrollmentSchema.index({ status: 1, createdAt: -1 });
academyEnrollmentSchema.index({ email: 1, course: 1, createdAt: -1 });

export default model("AcademyEnrollment", academyEnrollmentSchema);
