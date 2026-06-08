import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgency, requireClientInAgency, toResponse } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgency();
    const { id } = await params;
    await requireClientInAgency(id, ctx.agencyId);

    const reports = await prisma.monthlyReport.findMany({
      where: { clientId: id, agencyId: ctx.agencyId },
      orderBy: { reportMonth: "desc" },
      take: 12,
      include: { emailLogs: { select: { id: true, status: true } } },
    });

    return NextResponse.json(reports.map(r => ({
      id: r.id,
      reportMonth: r.reportMonth,
      status: r.status,
      generatedAt: r.generatedAt?.toISOString() ?? null,
      sentAt: r.sentAt?.toISOString() ?? null,
      pdfUrl: r.pdfUrl,
      errorMessage: r.errorMessage,
      gscClicks: r.gscClicks,
      gscImpressions: r.gscImpressions,
      gscPosition: r.gscPosition,
      gscCtr: r.gscCtr,
      recipientCount: r.emailLogs.length,
    })));
  } catch (e) {
    return toResponse(e);
  }
}
