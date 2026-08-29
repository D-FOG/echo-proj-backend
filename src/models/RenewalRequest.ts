import { Schema, model } from "mongoose";

const renewalRequestSchema = new Schema(
  {
    subscription: { type: Schema.Types.ObjectId, ref: "Subscription", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestType: { type: String, enum: ["renewal", "activation"], default: "renewal", index: true },
    status: { type: String, enum: ["pending", "approved", "completed", "rejected"], default: "pending", index: true },
    message: { type: String, trim: true, maxlength: 1000 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

renewalRequestSchema.index({ subscription: 1, user: 1, status: 1 });

export default model("RenewalRequest", renewalRequestSchema);
