import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgency, toResponse } from "@/lib/authz";
import { sendReportEmail, getMonthName } from "@/lib/email";
import { deleteReportFile } from "@/lib/report-storage";

export async function POST() {
  let ctx;
  try {
    ctx = await requireAgency();
  } catch (e) {
    return toResponse(e);
  }

  // Find all GENERATED reports (in this agency) that have a contactEmail and a PDF
  const reports = await prisma.monthlyReport.findMany({
    where: {
      agencyId: ctx.agencyId,
      status: "GENERATED",
      pdfUrl: { not: null },
      client: { excludeFromReports: false },
    },
    include: { client: { select: { id: true, name: true, contactEmail: true, ccEmails: true } } },
    orderBy: { reportMonth: "desc" },
  });

  const eligible = reports.filter(r => r.client.contactEmail);

  const results: { clientName: string; reportMonth: string; ok: boolean; error?: string }[] = [];

  for (const report of eligible) {
    const { client } = report;
    const monthName = getMonthName(report.reportMonth);
    try {
      const messageId = await sendReportEmail({
        agencyId: ctx.agencyId,
        to: client.contactEmail,
        cc: client.ccEmails,
        clientName: client.name,
        monthName,
        pdfUrl: report.pdfUrl!,
      });

      await prisma.monthlyReport.update({
        where: { id: report.id },
        data: { status: "SENT", sentAt: new Date(), emailTo: client.contactEmail, emailCc: client.ccEmails, pdfUrl: null },
      });

      // Report delivered — drop the PDF file, keep only the status record.
      await deleteReportFile(report.pdfUrl!);

      await prisma.reportEmailLog.create({
        data: {
          agencyId: ctx.agencyId,
          reportId: report.id,
          clientId: client.id,
          emailTo: client.contactEmail,
          emailCc: client.ccEmails,
          subject: `דוח SEO חודשי – ${client.name} – ${monthName}`,
          status: "sent",
          providerMessageId: messageId || null,
          sentAt: new Date(),
        },
      });

      results.push({ clientName: client.name, reportMonth: report.reportMonth, ok: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      await prisma.reportEmailLog.create({
        data: {
          agencyId: ctx.agencyId,
          reportId: report.id,
          clientId: client.id,
          emailTo: client.contactEmail,
          emailCc: client.ccEmails,
          subject: `דוח SEO חודשי – ${client.name} – ${monthName}`,
          status: "failed",
          errorMessage,
          sentAt: null,
        },
      });

      results.push({ clientName: client.name, reportMonth: report.reportMonth, ok: false, error: errorMessage });
    }
  }

  const sent   = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  return NextResponse.json({ sent, failed, total: eligible.length, results });
}

/** GET — preview how many reports are ready to send */
export async function GET() {
  let ctx;
  try {
    ctx = await requireAgency();
  } catch (e) {
    return toResponse(e);
  }

  const count = await prisma.monthlyReport.count({
    where: {
      agencyId: ctx.agencyId,
      status: "GENERATED",
      pdfUrl: { not: null },
      client: { contactEmail: { not: "" }, excludeFromReports: false },
    },
  });

  return NextResponse.json({ count });
}
