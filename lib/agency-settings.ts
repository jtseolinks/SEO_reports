import { prisma } from "./prisma";

// Agency settings hold no secrets anymore (SMTP credentials moved to the
// platform-level config, see lib/platform-settings.ts). SECRET_KEYS is kept as
// an empty list so the mask/whitelist plumbing stays in place if a secret is
// reintroduced later.
const SECRET_KEYS: (keyof AgencySettings)[] = [];

// Placeholder the API returns instead of a secret value (unused while there are
// no secret keys, but kept stable for the client contract).
export const SECRET_MASK = "********";

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

  // ── Email & sending ─────────────────────────────────────────────────────────
  // (SMTP transport credentials are platform-level — see lib/platform-settings.ts)
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

// Returns the agency settings (no secrets at this level), for server use such as
// resolving the email sender identity.
export async function getAgencySettings(agencyId: string): Promise<AgencySettings> {
  const rows = await prisma.agencySetting.findMany({ where: { agencyId, key: { in: KEYS } } });
  const map  = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const d    = defaults();
  return KEYS.reduce((acc, k) => {
    const stored = map[k];
    return { ...acc, [k]: stored ?? d[k] };
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
      .map(([key, value]) =>
        prisma.agencySetting.upsert({
          where:  { agencyId_key: { agencyId, key } },
          create: { agencyId, key, value: value ?? "" },
          update: { value: value ?? "" },
        })
      )
  );
}
