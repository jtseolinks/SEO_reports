import { OAuth2Client } from "google-auth-library";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";
import { encrypt, decrypt } from "./crypto";
import type { GoogleConnection } from "@/lib/generated/prisma/client";

/**
 * Build a tamper-proof OAuth `state` that binds the flow to one agency:
 *   "<agencyId>.<nonce>.<hmac>"  where hmac = HMAC-SHA256(NEXTAUTH_SECRET, agencyId.nonce)
 * The callback validates the HMAC so a state from another agency can't be swapped in.
 */
export function signOAuthState(agencyId: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  const nonce = randomBytes(16).toString("hex");
  const payload = `${agencyId}.${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

/** Verify a signed OAuth state and return its agencyId, or null if invalid. */
export function parseOAuthState(state: string | undefined | null): string | null {
  if (!state) return null;
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [agencyId, nonce, sig] = parts;
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  const expected = createHmac("sha256", secret).update(`${agencyId}.${nonce}`).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return agencyId;
}

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

/**
 * Exchange an OAuth code and persist the connection for a SPECIFIC agency.
 * One connection per agency (enforced by the unique agencyId): an upsert
 * replaces a prior connection for the same agency without touching others.
 */
export async function exchangeCodeAndSave(agencyId: string, code: string): Promise<void> {
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
    : null;

  await prisma.googleConnection.upsert({
    where: { agencyId },
    create: {
      agencyId,
      googleEmail: googleEmail ?? null,
      encryptedAccessToken,
      encryptedRefreshToken,
      expiresAt,
      scopes: GOOGLE_SCOPES,
      status: "CONNECTED",
      lastError: null,
    },
    update: {
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

export async function getGoogleConnection(agencyId: string): Promise<GoogleConnection | null> {
  return prisma.googleConnection.findUnique({ where: { agencyId } });
}

export async function disconnectGoogle(agencyId: string): Promise<void> {
  await prisma.googleConnection.deleteMany({ where: { agencyId } });
}

export async function getValidAccessToken(
  agencyId: string,
  options?: { force?: boolean }
): Promise<string | null> {
  const connection = await getGoogleConnection(agencyId);
  if (!connection) return null;
  // When `force` is set (e.g. on login) we retry the refresh even if a previous
  // attempt flagged the connection as REQUIRES_REAUTH — a stuck status caused by
  // a transient failure can then self-heal as long as the refresh token is valid.
  if (!options?.force && connection.status === "REQUIRES_REAUTH") return null;
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

export async function getAuthenticatedClient(agencyId: string): Promise<OAuth2Client | null> {
  const connection = await getGoogleConnection(agencyId);
  if (!connection || !connection.encryptedRefreshToken) return null;
  if (connection.status === "REQUIRES_REAUTH") return null;

  const client = createOAuth2Client();
  const refreshToken = decrypt(connection.encryptedRefreshToken);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}
