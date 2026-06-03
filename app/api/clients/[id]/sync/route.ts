import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedClient } from "@/lib/google-oauth";
import { fetchGscSummary, aggregateGsc } from "@/lib/gsc-api";
import { fetchGa4OrganicSummary } from "@/lib/ga4-api";
import { getReportPeriods } from "@/lib/report-data";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { reportMonth, startDate, endDate } = await request.json();

  if (!reportMonth && !(startDate && endDate)) {
    return NextResponse.json({ error: "reportMonth or startDate+endDate required" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { id },
    include: { googleProperties: true },
  });

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!client.googleProperties) return NextResponse.json({ error: "No Google properties mapped" }, { status: 400 });

  const { gscSiteUrl, ga4PropertyId } = client.googleProperties;
  const periods = getReportPeriods(reportMonth);
  const current = startDate && endDate
    ? { startDate, endDate, label: `${startDate} – ${endDate}` }
    : periods.current;
  const previous = periods.previous;

  try {
    const auth = await getAuthenticatedClient();
    if (!auth) return NextResponse.json({ error: "Google not connected" }, { status: 400 });

    const hasGa4 = !!ga4PropertyId;
    const emptyGa4 = { sessions: 0, revenue: 0 };

    const [gscRows, ga4, ga4Prev] = await Promise.all([
      fetchGscSummary(auth, gscSiteUrl, current.startDate, current.endDate, ["query"]),
      hasGa4
        ? fetchGa4OrganicSummary(auth, ga4PropertyId, current.startDate, current.endDate)
        : Promise.resolve(emptyGa4),
      hasGa4
        ? fetchGa4OrganicSummary(auth, ga4PropertyId, previous.startDate, previous.endDate)
        : Promise.resolve(emptyGa4),
    ]);

    const agg = aggregateGsc(gscRows);
    const totalImp = agg.impressions || 1;

    return NextResponse.json({
      reportMonth,
      period: { startDate: current.startDate, endDate: current.endDate, label: current.label },
      previousPeriod: { startDate: previous.startDate, endDate: previous.endDate, label: previous.label },
      gsc: {
        clicks: agg.clicks,
        impressions: agg.impressions,
        ctr: agg.totalCtrWeight / totalImp,
        position: agg.totalPosWeight / totalImp,
        queryCount: gscRows.length,
      },
      ga4: hasGa4 ? {
        sessions: ga4.sessions,
        revenue: ga4.revenue,
        prevSessions: ga4Prev.sessions,
        prevRevenue: ga4Prev.revenue,
      } : null,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
