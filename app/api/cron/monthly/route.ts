import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildReportData, getReportPeriods } from "@/lib/report-data";
import { generateReportHtml } from "@/lib/report-template";
import { generatePdf, buildReportFilename } from "@/lib/pdf-generator";
import { sendReportEmail, getMonthName } from "@/lib/email";
import { deleteReportFile } from "@/lib/report-storage";

type ClientResult = {
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

export async function GET(request: NextRequest) {
  // Verify CRON_SECRET to prevent unauthorized calls. Prefer the Authorization
  // header (not logged in access logs); fall back to ?secret= for compatibility.
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const headerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  const provided = headerSecret ?? request.nextUrl.searchParams.get("secret");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = new Date().getDate(); // day of month (1-31)
  const reportMonth = getPreviousMonth();
  const { current, previous } = getReportPeriods(reportMonth);

  // Find all active clients whose send day is today.
  // Skip clients explicitly excluded from reports, or with automatic sending
  // turned off — they must never receive an automatic email.
  const clients = await prisma.client.findMany({
    where: {
      status: "ACTIVE",
      reportSendDay: today,
      excludeFromReports: false,
      autoSend: true,
    },
    include: {
      googleProperties: true,
    },
  });

  const results: ClientResult[] = [];
  const agencyName = process.env.AGENCY_NAME ?? "SEO Agency";
  const agencyEmail = process.env.AGENCY_EMAIL ?? "";

  for (const client of clients) {
    // Skip if no property mapping
    if (!client.googleProperties) {
      results.push({
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
      // Check if report already generated for this month
      const existingReport = await prisma.monthlyReport.findUnique({
        where: { clientId_reportMonth: { clientId: client.id, reportMonth } },
      });

      if (existingReport?.status === "GENERATED" && existingReport.pdfUrl) {
        reportId = existingReport.id;
        pdfUrl = existingReport.pdfUrl;
      } else {
        // Create or reset the report record
        const report = await prisma.monthlyReport.upsert({
          where: { clientId_reportMonth: { clientId: client.id, reportMonth } },
          create: {
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

        // Generate the PDF
        const data = await buildReportData(client.id, reportMonth);
        const html = generateReportHtml(data, agencyName, agencyEmail);
        const filename = buildReportFilename(client.id, reportMonth);
        pdfUrl = await generatePdf(html, filename);

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

      // Send the email
      const monthName = getMonthName(reportMonth);
      const subject = `דוח SEO חודשי – ${client.name} – ${monthName}`;

      const messageId = await sendReportEmail({
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

      // Report delivered — remove the PDF file, keep only the status record.
      if (pdfUrl) await deleteReportFile(pdfUrl);

      await prisma.reportEmailLog.create({
        data: {
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

      results.push({ clientId: client.id, clientName: client.name, status: "sent" });
    } catch (err) {
      // One client failing must not stop others
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`Cron: failed for client ${client.name}:`, err);

      if (reportId) {
        const monthName = getMonthName(reportMonth);
        await prisma.reportEmailLog.create({
          data: {
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
        clientId: client.id,
        clientName: client.name,
        status: "failed",
        reason: errorMessage,
      });
    }
  }

  const summary = {
    date: new Date().toISOString(),
    reportMonth,
    sendDay: today,
    totalClients: clients.length,
    sent: results.filter((r) => r.status === "sent").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    results,
  };

  console.log("Cron monthly summary:", JSON.stringify(summary, null, 2));
  return NextResponse.json(summary);
}
