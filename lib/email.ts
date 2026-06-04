import nodemailer from "nodemailer";
import fs from "fs/promises";
import { getAgencySettings } from "./agency-settings";
import { reportFilePath } from "./report-storage";

async function createTransport() {
  const s = await getAgencySettings();
  const host = s.smtpHost || process.env.SMTP_HOST;
  const port = parseInt(s.smtpPort || process.env.SMTP_PORT || "587");
  const user = s.smtpUser || process.env.SMTP_USER;
  const pass = s.smtpPass || process.env.SMTP_PASS;

  if (!host || !user || !pass) throw new Error("SMTP לא מוגדר — הכנס פרטי שרת בהגדרות האימייל");

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export type SendReportEmailParams = {
  to: string;
  cc?: string[];
  clientName: string;
  monthName: string;
  pdfUrl: string; // e.g. /reports/report_xxx.pdf (served by the authenticated route)
};

function buildEmailSubject(clientName: string, monthName: string): string {
  return `דוח SEO חודשי – ${clientName} – ${monthName}`;
}

function buildEmailBody(clientName: string, monthName: string, agencyName: string, introText?: string): string {
  const intro = introText?.trim() ||
    `מצורף דוח ה-SEO החודשי עבור ${clientName} לחודש ${monthName}.\n\nהדוח כולל נתוני Search Console, נתוני תנועה אורגנית מ-GA4, השוואה לחודש הקודם והמלצות להמשך עבודה.`;
  return `שלום,\n\n${intro}\n\nבברכה,\n${agencyName}`;
}

function applyTemplateVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export async function sendReportEmail(params: SendReportEmailParams): Promise<string> {
  const { to, cc = [], clientName, monthName, pdfUrl } = params;
  const s = await getAgencySettings();
  const agencyName = s.agencyName || process.env.AGENCY_NAME || "SEO Agency";
  const fromName   = s.emailSenderName  || agencyName;
  const fromEmail  = s.emailSenderEmail || process.env.SMTP_FROM || "noreply@example.com";

  // Resolve the PDF file path on disk (private reports dir, not /public)
  const pdfFilePath = reportFilePath(pdfUrl);
  const pdfBuffer = await fs.readFile(pdfFilePath);
  const pdfFilename = pdfFilePath.split(/[\\/]/).pop() ?? "report.pdf";

  const bcc = (s.agencyBccEnabled === "true" && s.agencyBccEmail) ? s.agencyBccEmail : undefined;

  const subject = applyTemplateVars(
    s.emailSubjectTemplate || "דוח SEO חודשי – {client} – {month}",
    { client: clientName, month: monthName, agency: agencyName }
  );

  const plainText = buildEmailBody(clientName, monthName, agencyName, s.emailIntroText);

  // logoUrl must be absolute for email clients — resolve against NEXTAUTH_URL / APP_URL
  const baseUrl = (process.env.NEXTAUTH_URL || process.env.APP_URL || "").replace(/\/$/, "");
  const logoUrl = s.logoUrl
    ? (s.logoUrl.startsWith("http") ? s.logoUrl : `${baseUrl}${s.logoUrl}`)
    : "";

  // {introText} = only the intro paragraph, never the full plain-text body (avoids duplication)
  const introForHtml = s.emailIntroText?.trim() ||
    `הדוח כולל נתוני Search Console, נתוני תנועה אורגנית מ-GA4, השוואה לחודש הקודם והמלצות להמשך עבודה.`;

  let htmlBody: string | undefined;
  if (s.emailHtmlTemplate?.trim()) {
    htmlBody = applyTemplateVars(s.emailHtmlTemplate, {
      client:    clientName,
      month:     monthName,
      agency:    agencyName,
      introText: introForHtml,
      logoUrl,
    });
  }

  const transporter = await createTransport();

  const info = await transporter.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to,
    cc: cc.length > 0 ? cc : undefined,
    bcc,
    subject,
    text: plainText,
    ...(htmlBody ? { html: htmlBody } : {}),
    attachments: [
      {
        filename: pdfFilename,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  return info.messageId ?? "";
}

export async function sendTestEmail(to: string): Promise<string> {
  const s = await getAgencySettings();
  const agencyName = s.agencyName || process.env.AGENCY_NAME || "SEO Agency";
  const fromName   = s.emailSenderName  || agencyName;
  const fromEmail  = s.emailSenderEmail || process.env.SMTP_FROM || "noreply@example.com";
  const transporter = await createTransport();

  const info = await transporter.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject: `[Test] SEO Reports – email configuration test`,
    text: `This is a test email from ${agencyName} SEO Reports system.\n\nIf you received this, your SMTP configuration is working correctly.`,
  });

  return info.messageId ?? "";
}

export function getMonthName(reportMonth: string): string {
  // reportMonth = "2026-05"
  const [year, month] = reportMonth.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}
