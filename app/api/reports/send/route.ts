import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgency, toResponse } from "@/lib/authz";
import { sendReportEmail, getMonthName } from "@/lib/email";
import { deleteReportFile } from "@/lib/report-storage";

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAgency();
  } catch (e) {
    return toResponse(e);
  }

  const { reportId } = await request.json();
  if (!reportId) return NextResponse.json({ error: "reportId is required" }, { status: 400 });

  const report = await prisma.monthlyReport.findFirst({
    where: { id: reportId, agencyId: ctx.agencyId },
    include: { client: true },
  });

  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  if (!report.pdfUrl) return NextResponse.json({ error: "PDF not generated yet" }, { status: 400 });

  const client = report.client;
  const monthName = getMonthName(report.reportMonth);
  const subject = `דוח SEO חודשי – ${client.name} – ${monthName}`;

  let messageId = "";
  let sendStatus = "sent";
  let errorMessage: string | null = null;

  try {
    messageId = await sendReportEmail({
      agencyId: ctx.agencyId,
      to: client.contactEmail,
      cc: client.ccEmails,
      clientName: client.name,
      monthName,
      pdfUrl: report.pdfUrl,
    });

    await prisma.monthlyReport.update({
      where: { id: reportId },
      data: { status: "SENT", sentAt: new Date(), emailTo: client.contactEmail, emailCc: client.ccEmails, pdfUrl: null },
    });

    // Report delivered - the PDF content is no longer needed on disk.
    await deleteReportFile(report.pdfUrl);
  } catch (err) {
    sendStatus = "failed";
    errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Email send error:", err);
  }

  // Log delivery
  await prisma.reportEmailLog.create({
    data: {
      agencyId: ctx.agencyId,
      reportId,
      clientId: client.id,
      emailTo: client.contactEmail,
      emailCc: client.ccEmails,
      subject,
      status: sendStatus,
      providerMessageId: messageId || null,
      errorMessage,
      sentAt: sendStatus === "sent" ? new Date() : null,
    },
  });

  if (sendStatus === "failed") {
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }

  return NextResponse.json({ success: true, messageId });
}
