import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getAllAgencies } from "@/lib/tenant";
import { getAgencySettings } from "@/lib/agency-settings";
import { buildReportData, getReportPeriods } from "@/lib/report-data";
import { generateReportHtml } from "@/lib/report-template";
import { generatePdf, buildReportFilename } from "@/lib/pdf-generator";
import { sendReportEmail, getMonthName } from "@/lib/email";
import { deleteReportFile } from "@/lib/report-storage";
import { parseReportConfig } from "@/lib/report-config";

type ClientResult = {
  agencyId: string;
  clientId: string;
  clientName: string;
  status: "skipped" | "sent" | "failed";
  reason?: string;
};

function getPreviousMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function resolveLogoDataUrl(logoUrl: string): Promise<string> {
  if (!logoUrl) return "";
  try {
    const logoPath = path.join(process.cwd(), "public", logoUrl.replace(/^\//, ""));
    const buf = await fs.readFile(logoPath);
    const ext = path.extname(logoUrl).toLowerCase().replace(".", "");
    const mime = ext === "svg" ? "image/svg+xml" : ext === "png" ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

export async function GET(request: NextRequest) {
  // Verify CRON_SECRET to prevent unauthorized calls. Prefer the Authorization
  // header (not logged in access logs); fall back to ?secret= for compatibility.
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const headerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const provided = headerSecret ?? request.nextUrl.searchParams.get("secret");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = new Date().getDate(); // day of month (1-31)
  const reportMonth = getPreviousMonth();
  const { current, previous } = getReportPeriods(reportMonth);

  const results: ClientResult[] = [];
  const agencyErrors: { agencyId: string; error: string }[] = [];

  // No user session here — iterate every agency explicitly and pass its id to
  // all scoped helpers. A failure in one agency must not abort the others.
  const agencies = await getAllAgencies();

  for (const agency of agencies) {
    try {
      const settings = await getAgencySettings(agency.id);
      const agencyName = settings.agencyName || process.env.AGENCY_NAME || "SEO Agency";
      const agencyEmail = settings.contactEmail || process.env.AGENCY_EMAIL || "";
      const logoDataUrl = await resolveLogoDataUrl(settings.logoUrl);

      // Active clients in THIS agency whose send day is today (and not opted out).
      const clients = await prisma.client.findMany({
        where: {
          agencyId: agency.id,
          status: "ACTIVE",
          reportSendDay: today,
          excludeFromReports: false,
          autoSend: true,
        },
        include: { googleProperties: true },
      });

      for (const client of clients) {
        if (!client.googleProperties) {
          results.push({
            agencyId: agency.id,
            clientId: client.id,
            clientName: client.name,
            status: "skipped",
            reason: "No Google property mapping",
          });
          continue;
        }

        let reportId: string | null = null;
        let pdfUrl: string | null = null;

        try {
          const existingReport = await prisma.monthlyReport.findUnique({
            where: { clientId_reportMonth: { clientId: client.id, reportMonth } },
          });

          if (existingReport?.status === "GENERATED" && existingReport.pdfUrl) {
            reportId = existingReport.id;
            pdfUrl = existingReport.pdfUrl;
          } else {
            const report = await prisma.monthlyReport.upsert({
              where: { clientId_reportMonth: { clientId: client.id, reportMonth } },
              create: {
                agencyId: agency.id,
                clientId: client.id,
                reportMonth,
                periodStart: new Date(current.startDate),
                periodEnd: new Date(current.endDate),
                comparisonStart: new Date(previous.startDate),
                comparisonEnd: new Date(previous.endDate),
                status: "DRAFT",
              },
              update: { status: "DRAFT", errorMessage: null, pdfUrl: null },
            });
            reportId = report.id;

            const data = await buildReportData(agency.id, client.id, reportMonth);
            const cfg = parseReportConfig(client.reportConfig);
            const html = generateReportHtml(data, agencyName, agencyEmail, logoDataUrl, cfg);
            const filename = buildReportFilename(client.id, reportMonth);
            pdfUrl = await generatePdf(html, agency.id, filename);

            await prisma.monthlyReport.update({
              where: { id: reportId },
              data: {
                status: "GENERATED",
                pdfUrl,
                generatedAt: new Date(),
                gscClicks: data.gsc.clicks.current,
                gscImpressions: data.gsc.impressions.current,
                gscPosition: data.gsc.position.current,
                gscCtr: data.gsc.ctr.current,
              },
            });
          }

          const monthName = getMonthName(reportMonth);
          const subject = `דוח SEO חודשי – ${client.name} – ${monthName}`;

          const messageId = await sendReportEmail({
            agencyId: agency.id,
            to: client.contactEmail,
            cc: client.ccEmails,
            clientName: client.name,
            monthName,
            pdfUrl: pdfUrl!,
          });

          await prisma.monthlyReport.update({
            where: { id: reportId },
            data: {
              status: "SENT",
              sentAt: new Date(),
              emailTo: client.contactEmail,
              emailCc: client.ccEmails,
              pdfUrl: null,
            },
          });

          if (pdfUrl) await deleteReportFile(pdfUrl);

          await prisma.reportEmailLog.create({
            data: {
              agencyId: agency.id,
              reportId: reportId!,
              clientId: client.id,
              emailTo: client.contactEmail,
              emailCc: client.ccEmails,
              subject,
              status: "sent",
              providerMessageId: messageId,
              sentAt: new Date(),
            },
          });

          results.push({ agencyId: agency.id, clientId: client.id, clientName: client.name, status: "sent" });
        } catch (err) {
          // One client failing must not stop others.
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`Cron: failed for client ${client.name} (agency ${agency.id}):`, err);

          if (reportId) {
            const monthName = getMonthName(reportMonth);
            await prisma.reportEmailLog.create({
              data: {
                agencyId: agency.id,
                reportId,
                clientId: client.id,
                emailTo: client.contactEmail,
                emailCc: client.ccEmails,
                subject: `דוח SEO חודשי – ${client.name} – ${monthName}`,
                status: "failed",
                errorMessage,
              },
            }).catch(() => null);
          }

          results.push({
            agencyId: agency.id,
            clientId: client.id,
            clientName: client.name,
            status: "failed",
            reason: errorMessage,
          });
        }
      }
    } catch (err) {
      // Agency-level failure (e.g. settings/Google) — isolate to this agency.
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`Cron: agency ${agency.id} failed:`, err);
      agencyErrors.push({ agencyId: agency.id, error: errorMessage });
    }
  }

  const summary = {
    date: new Date().toISOString(),
    reportMonth,
    sendDay: today,
    agencies: agencies.length,
    totalClients: results.length,
    sent: results.filter((r) => r.status === "sent").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    agencyErrors,
    results,
  };

  console.log("Cron monthly summary:", JSON.stringify(summary, null, 2));
  return NextResponse.json(summary);
}
