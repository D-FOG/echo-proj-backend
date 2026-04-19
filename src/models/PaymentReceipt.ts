import { Schema, model } from "mongoose";

const paymentReceiptSchema = new Schema(
  {
    invoice: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiptFile: {
      url: String,
      publicId: String,
    },
    status: {
      type: String,
      enum: ["submitted", "confirmed", "rejected"],
      default: "submitted",
    },
    confirmedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    rejectionReason: {
      type: String,
    },
    submittedAt: {
      type: Date,
      default: () => new Date(),
    },
    confirmedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

export default model("PaymentReceipt", paymentReceiptSchema);
