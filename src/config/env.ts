import dotenv from "dotenv";

dotenv.config();

const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
};

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
  mailFrom: process.env.MAIL_FROM ?? process.env.ZOHO_MAIL_FROM ?? process.env.ADMIN_SUPPORT_EMAIL ?? "",
  adminSupportEmail: process.env.ADMIN_SUPPORT_EMAIL ?? process.env.ZOHO_MAIL_FROM ?? "",
};
