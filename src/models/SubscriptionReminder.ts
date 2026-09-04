import { Schema, model } from "mongoose";

const subscriptionReminderSchema = new Schema(
  {
    subscription: { type: Schema.Types.ObjectId, ref: "Subscription", required: true, index: true },
    reminderType: { type: String, enum: ["expiring", "expired"], required: true, index: true },
    recipientKind: { type: String, enum: ["user", "admin", "category"], required: true, index: true },
    recipientUser: { type: Schema.Types.ObjectId, ref: "User", index: true },
    recipientEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    sentAt: { type: Date, required: true, default: Date.now, index: true },
  },
  { timestamps: true },
);

subscriptionReminderSchema.index({
  subscription: 1,
  reminderType: 1,
  recipientKind: 1,
  recipientEmail: 1,
  sentAt: -1,
});

export default model("SubscriptionReminder", subscriptionReminderSchema);
