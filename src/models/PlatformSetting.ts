import { Schema, model } from "mongoose";

const platformSettingSchema = new Schema(
  {
    platformName: {
      type: String,
      default: "Echolalax Global",
    },
    defaultCurrency: {
      type: String,
      default: "NGN",
    },
    supportEmail: {
      type: String,
      default: "support@example.com",
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

export default model("PlatformSetting", platformSettingSchema);
