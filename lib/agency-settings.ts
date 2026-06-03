import { prisma } from "./prisma";

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

export async function getAgencySettings(): Promise<AgencySettings> {
  const rows = await prisma.agencySetting.findMany({ where: { key: { in: KEYS } } });
  const map  = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const d    = defaults();
  return KEYS.reduce((acc, k) => ({ ...acc, [k]: map[k] ?? d[k] }), {} as AgencySettings);
}

export async function saveAgencySettings(settings: Partial<AgencySettings>): Promise<void> {
  await Promise.all(
    Object.entries(settings).map(([key, value]) =>
      prisma.agencySetting.upsert({
        where:  { key },
        create: { key, value: value ?? "" },
        update: { value: value ?? "" },
      })
    )
  );
}
