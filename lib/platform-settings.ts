import { prisma } from "./prisma";
import { encrypt, decrypt } from "./crypto";

// Platform-wide settings: a single, non-tenant-scoped key/value store. Currently
// holds the shared SMTP transport used for every outgoing email. Managed only by
// super-admins (see app/api/super-admin/smtp). Mirrors agency-settings.ts but
// without an agencyId dimension - there is exactly one platform config.

const SECRET_KEYS: (keyof PlatformSettings)[] = ["smtpPass"];

// Placeholder returned to the client instead of the real secret. If a save
// request sends this back unchanged, the existing secret is preserved.
export const SECRET_MASK = "********";

function safeDecrypt(value: string): string {
  if (!value) return "";
  try {
    return decrypt(value);
  } catch {
    // Legacy plaintext value stored before encryption was introduced.
    return value;
  }
}

export type PlatformSettings = {
  smtpHost:      string; // e.g. smtp-relay.brevo.com
  smtpPort:      string; // 587
  smtpUser:      string;
  smtpPass:      string; // encrypted at rest
  smtpFromEmail: string; // default "From" address for platform mail
  smtpFromName:  string; // default "From" name
};

const KEYS: (keyof PlatformSettings)[] = [
  "smtpHost", "smtpPort", "smtpUser", "smtpPass", "smtpFromEmail", "smtpFromName",
];

function defaults(): PlatformSettings {
  return {
    smtpHost:      process.env.SMTP_HOST ?? "",
    smtpPort:      process.env.SMTP_PORT ?? "587",
    smtpUser:      process.env.SMTP_USER ?? "",
    smtpPass:      process.env.SMTP_PASS ?? "",
    smtpFromEmail: process.env.SMTP_FROM ?? "",
    smtpFromName:  process.env.SMTP_FROM_NAME ?? process.env.AGENCY_NAME ?? "Rankey SEO Reports",
  };
}

// Returns settings with secrets DECRYPTED (real values), for server-side use such
// as building the SMTP transport. Never hand this to the client - use maskSecrets.
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const rows = await prisma.platformSetting.findMany({ where: { key: { in: KEYS } } });
  const map  = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const d    = defaults();
  return KEYS.reduce((acc, k) => {
    const stored = map[k];
    const value = SECRET_KEYS.includes(k)
      ? (stored !== undefined ? safeDecrypt(stored) : d[k])
      : (stored ?? d[k]);
    return { ...acc, [k]: value };
  }, {} as PlatformSettings);
}

// Replaces secret values with a mask so they are never sent to the browser.
export function maskSecrets(settings: PlatformSettings): PlatformSettings {
  const masked = { ...settings };
  for (const k of SECRET_KEYS) {
    if (masked[k]) masked[k] = SECRET_MASK;
  }
  return masked;
}

export async function savePlatformSettings(settings: Partial<PlatformSettings>): Promise<void> {
  await Promise.all(
    Object.entries(settings)
      // Whitelist: only known keys may be written.
      .filter(([key]) => (KEYS as string[]).includes(key))
      // Ignore a secret that comes back as the unchanged mask.
      .filter(([key, value]) => !(SECRET_KEYS.includes(key as keyof PlatformSettings) && value === SECRET_MASK))
      .map(([key, value]) => {
        const raw = value ?? "";
        const stored = SECRET_KEYS.includes(key as keyof PlatformSettings) && raw
          ? encrypt(raw)
          : raw;
        return prisma.platformSetting.upsert({
          where:  { key },
          create: { key, value: stored },
          update: { value: stored },
        });
      })
  );
}

// True when the platform SMTP transport is fully configured.
export async function isPlatformSmtpConfigured(): Promise<boolean> {
  const s = await getPlatformSettings();
  return !!(s.smtpHost && s.smtpUser && s.smtpPass);
}
