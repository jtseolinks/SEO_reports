import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedClient } from "@/lib/google-oauth";
import { fetchGscDailyTrend } from "@/lib/gsc-api";
import { fetchGa4OrganicSummary } from "@/lib/ga4-api";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { id },
    include: { googleProperties: true },
  });

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!client.googleProperties?.gscSiteUrl) {
    return NextResponse.json({ error: "No GSC property mapped" }, { status: 400 });
  }

  const auth = await getAuthenticatedClient();
  if (!auth) return NextResponse.json({ error: "Google not connected" }, { status: 400 });

  const { gscSiteUrl, ga4PropertyId } = client.googleProperties;
  const hasGa4 = !!ga4PropertyId;

  // Calculate previous period with the same duration
  const startMs = new Date(startDate).getTime();
  const endMs   = new Date(endDate).getTime();
  const durationMs = endMs - startMs;
  const prevEndDate   = new Date(startMs - 86400000).toISOString().split("T")[0];
  const prevStartDate = new Date(startMs - durationMs - 86400000).toISOString().split("T")[0];

  try {
    const [trendData, ga4Summary, ga4Prev] = await Promise.all([
      fetchGscDailyTrend(auth, gscSiteUrl, startDate, endDate),
      hasGa4
        ? fetchGa4OrganicSummary(auth, ga4PropertyId, startDate, endDate)
        : Promise.resolve(null),
      hasGa4
        ? fetchGa4OrganicSummary(auth, ga4PropertyId, prevStartDate, prevEndDate)
        : Promise.resolve(null),
    ]);

    const totalClicks = trendData.reduce((s, r) => s + r.clicks, 0);
    const totalImpressions = trendData.reduce((s, r) => s + r.impressions, 0);
    const totalImp = totalImpressions || 1;
    const avgCtr = trendData.reduce((s, r) => s + r.ctr * r.impressions, 0) / totalImp;
    const avgPosition = trendData.reduce((s, r) => s + r.position * r.impressions, 0) / totalImp;

    return NextResponse.json({
      clicks: totalClicks,
      impressions: totalImpressions,
      ctr: avgCtr,
      position: avgPosition,
      trendData: trendData.map(r => ({ date: r.date, clicks: r.clicks, impressions: r.impressions })),
      ga4: ga4Summary
        ? {
            sessions: ga4Summary.sessions,
            revenue: ga4Summary.revenue,
            prevSessions: ga4Prev?.sessions ?? 0,
            prevRevenue: ga4Prev?.revenue ?? 0,
          }
        : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
