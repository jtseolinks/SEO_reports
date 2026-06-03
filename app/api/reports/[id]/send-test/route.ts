import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendReportEmail, getMonthName } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { to } = await request.json();
  if (!to) return NextResponse.json({ error: "to is required" }, { status: 400 });

  const { id } = await params;

  const report = await prisma.monthlyReport.findUnique({
    where: { id },
    include: { client: true },
  });

  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  if (!report.pdfUrl) return NextResponse.json({ error: "PDF not generated yet" }, { status: 400 });

  const monthName = getMonthName(report.reportMonth);

  const messageId = await sendReportEmail({
    to,
    cc: [],
    clientName: report.client.name,
    monthName,
    pdfUrl: report.pdfUrl,
  });

  return NextResponse.json({ success: true, messageId });
}
