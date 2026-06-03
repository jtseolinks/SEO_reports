import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const reports = await prisma.monthlyReport.findMany({
    where: { clientId: id },
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
}
