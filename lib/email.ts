import nodemailer from "nodemailer";
import fs from "fs/promises";
import { getAgencySettings } from "./agency-settings";
import { reportFilePathFromUrl } from "./report-storage";

async function createTransport(agencyId: string) {
  const s = await getAgencySettings(agencyId);
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
  agencyId: string;
  to: string;
  cc?: string[];
  clientName: string;
  monthName: string;
  pdfUrl: string; // e.g. /reports/<agencyId>/report_xxx.pdf (served by the authenticated route)
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
  const { agencyId, to, cc = [], clientName, monthName, pdfUrl } = params;
  const s = await getAgencySettings(agencyId);
  const agencyName = s.agencyName || process.env.AGENCY_NAME || "SEO Agency";
  const fromName   = s.emailSenderName  || agencyName;
  const fromEmail  = s.emailSenderEmail || process.env.SMTP_FROM || "noreply@example.com";

  // Resolve the PDF file path on disk (private reports dir, not /public)
  const pdfFilePath = reportFilePathFromUrl(pdfUrl);
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

  const transporter = await createTransport(agencyId);

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

export async function sendTestEmail(agencyId: string, to: string): Promise<string> {
  const s = await getAgencySettings(agencyId);
  const agencyName = s.agencyName || process.env.AGENCY_NAME || "SEO Agency";
  const fromName   = s.emailSenderName  || agencyName;
  const fromEmail  = s.emailSenderEmail || process.env.SMTP_FROM || "noreply@example.com";
  const transporter = await createTransport(agencyId);

  const info = await transporter.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject: `[Test] SEO Reports – email configuration test`,
    text: `This is a test email from ${agencyName} SEO Reports system.\n\nIf you received this, your SMTP configuration is working correctly.`,
  });

  return info.messageId ?? "";
}

export async function sendInvitationEmail(
  agencyId: string,
  to: string,
  inviterEmail: string,
  inviteUrl: string
): Promise<string> {
  const s = await getAgencySettings(agencyId);
  const agencyName = s.agencyName || process.env.AGENCY_NAME || "SEO Agency";
  const fromName   = s.emailSenderName  || agencyName;
  const fromEmail  = s.emailSenderEmail || process.env.SMTP_FROM || "noreply@example.com";
  const transporter = await createTransport(agencyId);

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"/><title>הזמנה להצטרף</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1E2D7D;padding:32px 40px;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:6px;">הזמנה לסוכנות</p>
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;">${agencyName}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">שלום,</p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.7;">
              <strong>${inviterEmail}</strong> הזמין אותך להצטרף ל-<strong>${agencyName}</strong> במערכת Rankey SEO Reports.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#1E2D7D;border-radius:8px;padding:14px 32px;text-align:center;">
                  <a href="${inviteUrl}" style="color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">קבל הזמנה ←</a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 6px;font-size:13px;color:#9CA3AF;">לא עובד הכפתור? העתק את הקישור:</p>
            <p style="margin:0 0 20px;font-size:12px;"><a href="${inviteUrl}" dir="ltr" style="color:#1E2D7D;word-break:break-all;">${inviteUrl}</a></p>
            <p style="margin:0;font-size:13px;color:#9CA3AF;">הקישור תקף ל-7 ימים.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;">מייל זה נשלח אוטומטית על ידי מערכת Rankey SEO Reports</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const info = await transporter.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject: `הוזמנת להצטרף ל-${agencyName}`,
    text: `שלום,\n\n${inviterEmail} הזמין אותך להצטרף ל-${agencyName} במערכת Rankey SEO Reports.\n\nלחץ על הקישור:\n${inviteUrl}\n\nהקישור תקף ל-7 ימים.\n\nבברכה,\n${agencyName}`,
    html,
  });

  return info.messageId ?? "";
}

export function getMonthName(reportMonth: string): string {
  // reportMonth = "2026-05"
  const [year, month] = reportMonth.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}
