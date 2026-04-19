import cors from "cors";
import express from "express";

import adminRoutes from "./routes/admin.routes";
import authRoutes from "./routes/auth.routes";
import { env } from "./config/env";
import { setupSwagger } from "./config/swagger";
import userRoutes from "./routes/user.routes";
import invoiceRoutes from "./routes/invoice.routes";
import { exchangeZohoCode, fetchZohoMailAccounts, fetchZohoProfile, getZohoAuthUrl, refreshZohoAccessToken, sendZohoEmail } from "./utils/zoho";
import { errorHandler } from "./middleware/error.middleware";
import { notFoundHandler } from "./middleware/not-found.middleware";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

setupSwagger(app);

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Echo backend is running",
  });
});

app.get("/api/zoho/auth-url", (_req, res) => {
  res.status(200).json({
    success: true,
    authUrl: getZohoAuthUrl(),
  });
});

app.get("/api/zoho/auth", (_req, res) => {
  return res.redirect(getZohoAuthUrl());
});

app.get("/api/zoho/callback", async (req, res) => {
  const rawCode = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
  const code = typeof rawCode === "string" ? rawCode : undefined;
  const rawError = Array.isArray(req.query.error) ? req.query.error[0] : req.query.error;
  const error = typeof rawError === "string" ? rawError : undefined;

  if (error) {
    return res.status(400).json({
      success: false,
      message: "Zoho returned an error during authorization.",
      error,
      query: req.query,
    });
  }

  if (!code) {
    return res.status(400).json({
      success: false,
      message: "Missing Zoho authorization code.",
      query: req.query,
    });
  }

  try {
    const tokenData = await exchangeZohoCode(code);
    const profile = await fetchZohoProfile(tokenData.access_token);

    return res.status(200).json({
      success: true,
      message: "Zoho token exchange succeeded.",
      tokenData,
      profile,
    });
  } catch (err) {
    console.error("Zoho callback exchange failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to exchange Zoho authorization code.",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/zoho/refresh", async (_req, res) => {
  try {
    const tokenData = await refreshZohoAccessToken(env.zohoRefreshToken);
    return res.status(200).json({
      success: true,
      tokenData,
    });
  } catch (err) {
    console.error("Zoho refresh failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to refresh Zoho access token.",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/zoho/accounts", async (_req, res) => {
  try {
    const tokenData = await refreshZohoAccessToken(env.zohoRefreshToken);
    const accounts = await fetchZohoMailAccounts(tokenData.access_token);
    return res.status(200).json({
      success: true,
      accounts,
    });
  } catch (err) {
    console.error("Zoho accounts lookup failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve Zoho mail accounts.",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/zoho/profile", async (_req, res) => {
  try {
    const tokenData = await refreshZohoAccessToken(env.zohoRefreshToken);
    const profile = await fetchZohoProfile(tokenData.access_token);
    return res.status(200).json({
      success: true,
      profile,
    });
  } catch (err) {
    console.error("Zoho profile lookup failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve Zoho profile.",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post("/api/zoho/test-email", async (req, res) => {
  try {
    const { to, cc, bcc, subject, content, askReceipt } = req.body;
    if (!to || !subject || !content) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: to, subject, content",
      });
    }

    const tokenData = await refreshZohoAccessToken(env.zohoRefreshToken);
    console.log(tokenData);
    const accountId = env.zohoMailAccountId;

    const emailResult = await sendZohoEmail(tokenData.access_token, accountId, {
      fromAddress: env.mailFrom,
      toAddress: to,
      ccAddress: cc,
      bccAddress: bcc,
      subject,
      content,
      askReceipt: askReceipt === "yes" ? "yes" : undefined,
    });

    return res.status(200).json({
      success: true,
      message: "Test email sent successfully.",
      emailResult,
    });
  } catch (err) {
    console.error("Zoho test email failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to send test email.",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/invoices", invoiceRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
