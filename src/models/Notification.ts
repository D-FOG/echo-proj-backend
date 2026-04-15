import { Schema, model } from "mongoose";

const notificationSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    channel: {
      type: String,
      enum: ["email", "push", "in_app"],
      required: true,
    },
    audience: {
      type: String,
      enum: ["all", "users", "admins"],
      default: "all",
    },
    status: {
      type: String,
      enum: ["draft", "sent"],
      default: "sent",
    },
    sentAt: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export default model("Notification", notificationSchema);
