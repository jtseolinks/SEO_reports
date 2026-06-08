import { NextRequest, NextResponse } from "next/server";
import { HttpError, requireAgency, requireClientInAgency, toResponse } from "@/lib/authz";
import { getAuthenticatedClient } from "@/lib/google-oauth";
import { fetchGscDailyTrend } from "@/lib/gsc-api";
import { fetchGa4OrganicSummary } from "@/lib/ga4-api";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  let ctx;
  try {
    ctx = await requireAgency();
  } catch (e) {
    return toResponse(e);
  }

  try {
    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
    }

    const client = await requireClientInAgency(id, ctx.agencyId, { googleProperties: true });
    if (!client.googleProperties?.gscSiteUrl) {
      return NextResponse.json({ error: "No GSC property mapped" }, { status: 400 });
    }

    const auth = await getAuthenticatedClient(ctx.agencyId);
    if (!auth) return NextResponse.json({ error: "Google not connected" }, { status: 400 });

    const { gscSiteUrl, ga4PropertyId } = client.googleProperties;
    const hasGa4 = !!ga4PropertyId;

    // Calculate previous period with the same duration
    const startMs = new Date(startDate).getTime();
    const endMs   = new Date(endDate).getTime();
    const durationMs = endMs - startMs;
    const prevEndDate   = new Date(startMs - 86400000).toISOString().split("T")[0];
    const prevStartDate = new Date(startMs - durationMs - 86400000).toISOString().split("T")[0];

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
  } catch (e) {
    if (e instanceof HttpError) return toResponse(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
