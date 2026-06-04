import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendReportEmail, getMonthName } from "@/lib/email";
import { deleteReportFile } from "@/lib/report-storage";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find all GENERATED reports that have a contactEmail and a PDF
  const reports = await prisma.monthlyReport.findMany({
    where: {
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
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const count = await prisma.monthlyReport.count({
    where: {
      status: "GENERATED",
      pdfUrl: { not: null },
      client: { contactEmail: { not: "" }, excludeFromReports: false },
    },
  });

  return NextResponse.json({ count });
}
