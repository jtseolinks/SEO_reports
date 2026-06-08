import { prisma } from "./prisma";
import { encrypt, decrypt } from "./crypto";

// Keys whose values are secrets — encrypted at rest and never returned raw to
// the client (the API route masks them).
const SECRET_KEYS: (keyof AgencySettings)[] = ["smtpPass"];

// Placeholder the API returns instead of the real secret. If a save request
// sends this value back unchanged, the existing secret is preserved.
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

export type AgencySettings = {
  // ── Agency details ──────────────────────────────────────────────────────────
  agencyName:    string;
  agencyUrl:     string;
  contactName:   string;
  contactEmail:  string;
  description:   string;
  logoUrl:       string;

  // ── Report branding ─────────────────────────────────────────────────────────
  reportPrimaryColor: string;   // hex, default "#1E2D7D"
  reportAccentColor:  string;   // hex, default "#1E6FBF"
  reportFooterText:   string;   // custom footer line in PDF

  // ── SMTP configuration ──────────────────────────────────────────────────────
  smtpHost: string;  // e.g. smtp-relay.brevo.com
  smtpPort: string;  // 587
  smtpUser: string;
  smtpPass: string;

  // ── Email & sending ─────────────────────────────────────────────────────────
  emailSenderName:      string; // "From" name
  emailSenderEmail:     string; // "From" / reply-to address
  emailSubjectTemplate: string; // e.g. "דוח SEO חודשי – {client} – {month}"
  emailIntroText:       string; // opening paragraph in email body
  agencyBccEmail:       string; // always BCC'd on every report (agency monitoring)
  agencyBccEnabled:     string; // "true" | "false"
  emailHtmlTemplate:    string; // full HTML body; variables: {client} {month} {agency} {introText}

  // ── Default scheduling ──────────────────────────────────────────────────────
  defaultSendDay:    string;    // "5" = 5th of month
  defaultLanguage:   string;    // "he" | "en"
  defaultAutoSend:   string;    // "true" | "false"
};

const KEYS: (keyof AgencySettings)[] = [
  "agencyName", "agencyUrl", "contactName", "contactEmail", "description", "logoUrl",
  "reportPrimaryColor", "reportAccentColor", "reportFooterText",
  "smtpHost", "smtpPort", "smtpUser", "smtpPass",
  "emailSenderName", "emailSenderEmail", "emailSubjectTemplate", "emailIntroText",
  "agencyBccEmail", "agencyBccEnabled", "emailHtmlTemplate",
  "defaultSendDay", "defaultLanguage", "defaultAutoSend",
];

function defaults(): AgencySettings {
  return {
    agencyName:   process.env.AGENCY_NAME  ?? "",
    agencyUrl:    "",
    contactName:  "",
    contactEmail: process.env.AGENCY_EMAIL ?? "",
    description:  "",
    logoUrl:      "",

    reportPrimaryColor: "#1E2D7D",
    reportAccentColor:  "#1E6FBF",
    reportFooterText:   "",

    smtpHost: process.env.SMTP_HOST ?? "",
    smtpPort: process.env.SMTP_PORT ?? "587",
    smtpUser: process.env.SMTP_USER ?? "",
    smtpPass: process.env.SMTP_PASS ?? "",

    emailSenderName:      process.env.AGENCY_NAME  ?? "",
    emailSenderEmail:     process.env.AGENCY_EMAIL ?? "",
    emailSubjectTemplate: "דוח SEO חודשי – {client} – {month}",
    emailIntroText:       "",
    agencyBccEmail:       "",
    agencyBccEnabled:     "true",
    emailHtmlTemplate:    "",

    defaultSendDay:  "5",
    defaultLanguage: "he",
    defaultAutoSend: "true",
  };
}

// Returns settings with secrets DECRYPTED (real values), for internal/server use
// such as sending email. Never return this object directly to the client — use
// maskSecrets() for that.
export async function getAgencySettings(agencyId: string): Promise<AgencySettings> {
  const rows = await prisma.agencySetting.findMany({ where: { agencyId, key: { in: KEYS } } });
  const map  = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const d    = defaults();
  return KEYS.reduce((acc, k) => {
    const stored = map[k];
    const value = SECRET_KEYS.includes(k)
      ? (stored !== undefined ? safeDecrypt(stored) : d[k])
      : (stored ?? d[k]);
    return { ...acc, [k]: value };
  }, {} as AgencySettings);
}

// Replaces secret values with a mask so they are never sent to the browser.
export function maskSecrets(settings: AgencySettings): AgencySettings {
  const masked = { ...settings };
  for (const k of SECRET_KEYS) {
    if (masked[k]) masked[k] = SECRET_MASK;
  }
  return masked;
}

export async function saveAgencySettings(
  agencyId: string,
  settings: Partial<AgencySettings>
): Promise<void> {
  await Promise.all(
    Object.entries(settings)
      // Whitelist: only known keys may be written (prevents storage pollution).
      .filter(([key]) => (KEYS as string[]).includes(key))
      // Ignore a secret that comes back as the unchanged mask.
      .filter(([key, value]) => !(SECRET_KEYS.includes(key as keyof AgencySettings) && value === SECRET_MASK))
      .map(([key, value]) => {
        const raw = value ?? "";
        const stored = SECRET_KEYS.includes(key as keyof AgencySettings) && raw
          ? encrypt(raw)
          : raw;
        return prisma.agencySetting.upsert({
          where:  { agencyId_key: { agencyId, key } },
          create: { agencyId, key, value: stored },
          update: { value: stored },
        });
      })
  );
}
