import { Schema, model } from "mongoose";

const subscriptionSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User", index: true },
    customerName: { type: String, required: true, trim: true, index: true },
    iucNumber: { type: String, required: true, trim: true, index: true },
    provider: { type: String, required: true, trim: true, index: true },
    bouquet: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, required: true, index: true },
    durationDays: { type: Number, min: 1 },
    durationMonths: { type: Number, min: 1 },
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true },
);

subscriptionSchema.index({ provider: 1, endDate: 1 });
subscriptionSchema.index({ customerName: 1, iucNumber: 1 });

export default model("Subscription", subscriptionSchema);
