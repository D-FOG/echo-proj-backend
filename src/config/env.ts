import dotenv from "dotenv";

dotenv.config();

const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
};

const getOptionalNumberEnv = (key: string, fallback: number): number => {
  const rawValue = process.env[key];
  if (!rawValue) return fallback;
  const value = Number(rawValue);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const getOptionalListEnv = (key: string): string[] =>
  (process.env[key] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

export const env = {
  port: Number(process.env.PORT ?? 5000),
  mongodbUri: getEnv("MONGODB_URI"),
  jwtSecret: getEnv("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:3000",
  zohoAccountsBaseUrl: process.env.ZOHO_ACCOUNTS_BASE_URL ?? "https://accounts.zoho.com",
  zohoMailApiBaseUrl: process.env.ZOHO_MAIL_API_BASE_URL ?? "https://mail.zoho.com/api",
  zohoMailAccountId: process.env.ZOHO_MAIL_ACCOUNT_ID ?? "",
  zohoClientId: process.env.ZOHO_CLIENT_ID ?? "",
  zohoClientSecret: process.env.ZOHO_CLIENT_SECRET ?? "",
  zohoRefreshToken: process.env.ZOHO_REFRESH_TOKEN ?? "",
  zohoAccessToken: process.env.ZOHO_ACCESS_TOKEN ?? "",
  zohoRedirectUri: process.env.ZOHO_REDIRECT_URI ?? "http://localhost:5000/api/zoho/callback",
  zohoOauthScope: process.env.ZOHO_OAUTH_SCOPE ?? "AaaServer.profile.Read ZohoMail.messages.CREATE ZohoMail.accounts.READ",
  mailFrom: process.env.MAIL_FROM ?? "",
  adminSupportEmail: process.env.ADMIN_SUPPORT_EMAIL ?? process.env.ZOHO_MAIL_FROM ?? "",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  bankAccountName: process.env.BANK_ACCOUNT_NAME ?? "Echolalax Global",
  bankAccountNumber: process.env.BANK_ACCOUNT_NUMBER ?? "0000000000",
  bankName: process.env.BANK_NAME ?? "First Bank",
  userQuickLoginEmail: process.env.USER_QUICK_LOGIN_EMAIL ?? "",
  userQuickLoginPasscode: process.env.USER_QUICK_LOGIN_PASSCODE ?? "",
  adminQuickLoginEmail: process.env.ADMIN_QUICK_LOGIN_EMAIL ?? "",
  adminQuickLoginPasscode: process.env.ADMIN_QUICK_LOGIN_PASSCODE ?? "",
  subscriptionWarningDays: getOptionalNumberEnv("SUBSCRIPTION_WARNING_DAYS", 10),
  subscriptionReminderEnabled: process.env.SUBSCRIPTION_REMINDER_ENABLED !== "false",
  subscriptionReminderIntervalMinutes: getOptionalNumberEnv("SUBSCRIPTION_REMINDER_INTERVAL_MINUTES", 24 * 60),
  subscriptionReminderBatchSize: getOptionalNumberEnv("SUBSCRIPTION_REMINDER_BATCH_SIZE", 200),
  subscriptionReminderRecipientEmails: getOptionalListEnv("SUBSCRIPTION_REMINDER_RECIPIENT_EMAILS"),
};
