import { Schema, model } from "mongoose";

const subscriptionSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User", index: true },
    customerName: { type: String, trim: true, index: true },
    categoryName: { type: String, trim: true, default: "General", index: true },
    iucNumber: { type: String, required: true, trim: true, index: true },
    tagId: { type: String, trim: true, index: true },
    serialNumber: { type: String, trim: true, index: true },
    model: { type: String, trim: true },
    provider: { type: String, trim: true, index: true },
    bouquet: { type: String, trim: true },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, required: true, index: true },
    durationDays: { type: Number, min: 1 },
    durationMonths: { type: Number, min: 1 },
    lifecycleStatus: { type: String, enum: ["pending", "active"], default: "active", index: true },
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true },
);

subscriptionSchema.index({ provider: 1, endDate: 1 });
subscriptionSchema.index({ customerName: 1, iucNumber: 1 });
subscriptionSchema.index({ categoryName: 1, lifecycleStatus: 1 });

export default model("Subscription", subscriptionSchema);
