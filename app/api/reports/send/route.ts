import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendReportEmail, getMonthName } from "@/lib/email";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reportId } = await request.json();
  if (!reportId) return NextResponse.json({ error: "reportId is required" }, { status: 400 });

  const report = await prisma.monthlyReport.findUnique({
    where: { id: reportId },
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
      to: client.contactEmail,
      cc: client.ccEmails,
      clientName: client.name,
      monthName,
      pdfUrl: report.pdfUrl,
    });

    await prisma.monthlyReport.update({
      where: { id: reportId },
      data: { status: "SENT", sentAt: new Date(), emailTo: client.contactEmail, emailCc: client.ccEmails },
    });
  } catch (err) {
    sendStatus = "failed";
    errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Email send error:", err);
  }

  // Log delivery
  await prisma.reportEmailLog.create({
    data: {
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
