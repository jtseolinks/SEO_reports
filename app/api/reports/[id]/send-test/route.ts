import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgency, toResponse } from "@/lib/authz";
import { sendReportEmail, getMonthName } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  let ctx;
  try {
    ctx = await requireAgency();
  } catch (e) {
    return toResponse(e);
  }

  const { to } = await request.json();
  if (!to) return NextResponse.json({ error: "to is required" }, { status: 400 });

  const { id } = await params;

  const report = await prisma.monthlyReport.findFirst({
    where: { id, agencyId: ctx.agencyId },
    include: { client: true },
  });

  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  if (!report.pdfUrl) return NextResponse.json({ error: "PDF not generated yet" }, { status: 400 });

  const monthName = getMonthName(report.reportMonth);

  const messageId = await sendReportEmail({
    agencyId: ctx.agencyId,
    to,
    cc: [],
    clientName: report.client.name,
    monthName,
    pdfUrl: report.pdfUrl,
  });

  return NextResponse.json({ success: true, messageId });
}
