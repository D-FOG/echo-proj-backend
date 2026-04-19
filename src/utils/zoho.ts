import { env } from "../config/env";

export type ZohoTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  api_domain?: string;
  token_type?: string;
  [key: string]: unknown;
};

export const getZohoRedirectUri = (): string => env.zohoRedirectUri;

export const getZohoAuthUrl = (): string => {
  const scope = env.zohoOauthScope.trim().replace(/[,\s]+/g, " ");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.zohoClientId,
    scope,
    redirect_uri: getZohoRedirectUri(),
    access_type: "offline",
    prompt: "consent",
  });

  return `${env.zohoAccountsBaseUrl}/oauth/v2/auth?${params.toString()}`;
};

const exchangeToken = async (body: URLSearchParams): Promise<ZohoTokenResponse> => {
  const response = await fetch(`${env.zohoAccountsBaseUrl}/oauth/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = (await response.json()) as ZohoTokenResponse & { error?: string; error_description?: string };

  if (!response.ok || !data.access_token) {
    throw new Error(`Zoho token request failed: ${data.error ?? response.statusText} ${data.error_description ?? ""}`);
  }

  return data;
};

export const exchangeZohoCode = async (code: string): Promise<ZohoTokenResponse> => {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: env.zohoClientId,
    client_secret: env.zohoClientSecret,
    redirect_uri: getZohoRedirectUri(),
    code,
  });

  return exchangeToken(body);
};

export const refreshZohoAccessToken = async (refreshToken: string): Promise<ZohoTokenResponse> => {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env.zohoClientId,
    client_secret: env.zohoClientSecret,
    refresh_token: refreshToken,
  });

  return exchangeToken(body);
};

export const fetchZohoMailAccounts = async (accessToken: string) => {
  const response = await fetch(`${env.zohoMailApiBaseUrl}/accounts`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      Accept: "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Zoho accounts request failed: ${response.status} ${JSON.stringify(data)}`);
  }

  return data;
};

export const fetchZohoProfile = async (accessToken: string) => {
  const response = await fetch(`${env.zohoAccountsBaseUrl}/oauth/user/info`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      Accept: "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Zoho profile request failed: ${response.status} ${JSON.stringify(data)}`);
  }

  return data;
};

export const sendZohoEmail = async (accessToken: string, accountId: string, emailData: {
  fromAddress: string;
  toAddress: string;
  ccAddress?: string;
  bccAddress?: string;
  subject: string;
  content: string;
  mailFormat?: "html" | "plaintext";
  askReceipt?: "yes" | "no";
}) => {
  const body: Record<string, unknown> = {
    fromAddress: emailData.fromAddress,
    toAddress: emailData.toAddress,
    subject: emailData.subject,
    content: emailData.content,
  };

  if (emailData.ccAddress) {
    body.ccAddress = emailData.ccAddress;
  }

  if (emailData.bccAddress) {
    body.bccAddress = emailData.bccAddress;
  }

  if (emailData.mailFormat) {
    body.mailFormat = emailData.mailFormat;
  }

  if (emailData.askReceipt) {
    body.askReceipt = emailData.askReceipt;
  }

  const response = await fetch(`${env.zohoMailApiBaseUrl}/accounts/${accountId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Zoho send email failed: ${response.status} ${JSON.stringify(data)}`);
  }

  return data;
};
