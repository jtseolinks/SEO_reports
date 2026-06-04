import { OAuth2Client } from "google-auth-library";
import { prisma } from "./prisma";
import { encrypt, decrypt } from "./crypto";
import type { GoogleConnection } from "@/lib/generated/prisma/client";

export function createOAuth2Client(): OAuth2Client {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export const OAUTH_STATE_COOKIE = "google_oauth_state";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/business.manage",
];

export function getAuthorizationUrl(state: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state,
  });
}

export async function exchangeCodeAndSave(code: string): Promise<void> {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token received. Revoke app access in Google account and try again."
    );
  }

  // Fetch the Google account email
  let googleEmail: string | undefined;
  try {
    client.setCredentials(tokens);
    const { google } = await import("googleapis");
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data } = await oauth2.userinfo.get();
    googleEmail = data.email ?? undefined;
  } catch {
    // Email is optional — continue without it
  }

  const encryptedAccessToken = tokens.access_token
    ? encrypt(tokens.access_token)
    : null;
  const encryptedRefreshToken = encrypt(tokens.refresh_token);
  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date)
    : undefined;

  // Delete any existing connections (single-connection system)
  await prisma.googleConnection.deleteMany();

  await prisma.googleConnection.create({
    data: {
      googleEmail: googleEmail ?? null,
      encryptedAccessToken,
      encryptedRefreshToken,
      expiresAt,
      scopes: GOOGLE_SCOPES,
      status: "CONNECTED",
      lastError: null,
    },
  });
}

export async function getGoogleConnection(): Promise<GoogleConnection | null> {
  return prisma.googleConnection.findFirst({
    orderBy: { createdAt: "desc" },
  });
}

export async function getValidAccessToken(): Promise<string | null> {
  const connection = await getGoogleConnection();
  if (!connection) return null;
  if (connection.status === "REQUIRES_REAUTH") return null;
  if (!connection.encryptedRefreshToken) return null;

  const client = createOAuth2Client();
  const refreshToken = decrypt(connection.encryptedRefreshToken);
  client.setCredentials({ refresh_token: refreshToken });

  try {
    const { credentials } = await client.refreshAccessToken();

    // Update stored access token
    if (credentials.access_token) {
      await prisma.googleConnection.update({
        where: { id: connection.id },
        data: {
          encryptedAccessToken: encrypt(credentials.access_token),
          expiresAt: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : undefined,
          status: "CONNECTED",
          lastError: null,
        },
      });
    }

    return credentials.access_token ?? null;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await prisma.googleConnection.update({
      where: { id: connection.id },
      data: {
        status: "REQUIRES_REAUTH",
        lastError: errorMessage,
      },
    });
    return null;
  }
}

export async function getAuthenticatedClient(): Promise<OAuth2Client | null> {
  const connection = await getGoogleConnection();
  if (!connection || !connection.encryptedRefreshToken) return null;
  if (connection.status === "REQUIRES_REAUTH") return null;

  const client = createOAuth2Client();
  const refreshToken = decrypt(connection.encryptedRefreshToken);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}
