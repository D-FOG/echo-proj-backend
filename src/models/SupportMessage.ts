import { Schema, model } from "mongoose";

const supportConversationEntrySchema = new Schema(
  {
    senderRole: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    senderEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  },
);

const supportMessageSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
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
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
    },
    replyMessage: {
      type: String,
      trim: true,
    },
    urgency: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["open", "admin_replied", "awaiting_user_confirmation", "completed"],
      default: "open",
    },
    messages: {
      type: [supportConversationEntrySchema],
      default: [],
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    repliedAt: {
      type: Date,
    },
    adminCompletionRequestedAt: {
      type: Date,
    },
    resolvedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    userHiddenAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

supportMessageSchema.index({ user: 1, createdAt: -1 });
supportMessageSchema.index({ status: 1, lastMessageAt: -1 });

export default model("SupportMessage", supportMessageSchema);
