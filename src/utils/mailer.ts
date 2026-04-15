import { env } from "../config/env";

type MailPayload = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

type ZohoAccessTokenCache = {
  token: string;
  expiresAt: number;
} | null;

let tokenCache: ZohoAccessTokenCache = env.zohoAccessToken
  ? {
      token: env.zohoAccessToken,
      expiresAt: Date.now() + 45 * 60 * 1000,
    }
  : null;

const canSendMail = Boolean(
  env.zohoMailAccountId &&
    env.mailFrom &&
    ((env.zohoClientId && env.zohoClientSecret && env.zohoRefreshToken) || env.zohoAccessToken),
);

const extractAddress = (value: string) => {
  const match = value.match(/<([^>]+)>/);
  return match?.[1]?.trim() || value.trim();
};

const getZohoAccessToken = async () => {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  if (!env.zohoClientId || !env.zohoClientSecret || !env.zohoRefreshToken) {
    if (env.zohoAccessToken) {
      return env.zohoAccessToken;
    }

    throw new Error("Zoho OAuth credentials are not configured");
  }

  const params = new URLSearchParams({
    refresh_token: env.zohoRefreshToken,
    client_id: env.zohoClientId,
    client_secret: env.zohoClientSecret,
    grant_type: "refresh_token",
  });

  const response = await fetch(`${env.zohoAccountsBaseUrl}/oauth/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(`Zoho token refresh failed: ${data.error ?? response.statusText}`);
  }

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max((data.expires_in ?? 3600) - 120, 60) * 1000,
  };

  return tokenCache.token;
};

export const sendMail = async ({ to, subject, text, html }: MailPayload) => {
  if (!canSendMail) {
    console.warn("Zoho mailer not configured. Skipping email:", subject);
    return;
  }

  try {
    const accessToken = await getZohoAccessToken();
    const response = await fetch(`${env.zohoMailApiBaseUrl}/accounts/${env.zohoMailAccountId}/messages`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
      body: JSON.stringify({
        fromAddress: extractAddress(env.mailFrom),
        toAddress: Array.isArray(to) ? to.join(",") : to,
        subject,
        content: html ?? text,
        mailFormat: html ? "html" : "plaintext",
        encoding: "UTF-8",
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Zoho Mail API send failed: ${response.status} ${body}`);
    }
  } catch (error) {
    console.error("Failed to send email:", subject, error);
  }
};
