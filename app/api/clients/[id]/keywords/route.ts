import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgency, requireClientInAgency, toResponse } from "@/lib/authz";
import { getAuthenticatedClient } from "@/lib/google-oauth";
import { fetchGscSummary } from "@/lib/gsc-api";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgency();
    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
    }

    const client = await requireClientInAgency(id, ctx.agencyId, { googleProperties: true });
    if (!client.googleProperties?.gscSiteUrl) {
      return NextResponse.json({ error: "No GSC property" }, { status: 400 });
    }

    const auth = await getAuthenticatedClient(ctx.agencyId);
    if (!auth) return NextResponse.json({ error: "Google not connected" }, { status: 400 });

    // Two prior windows of the SAME length as the selected period, shifted back
    // one and two windows — for the per-keyword position trend (prev month /
    // 2 months ago when the period is ~1 month).
    const DAY_MS = 86_400_000;
    const shift = (iso: string, days: number) => {
      const d = new Date(iso + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().split("T")[0];
    };
    const winLen = Math.round((Date.parse(endDate) - Date.parse(startDate)) / DAY_MS) + 1;
    const prev1End   = shift(startDate, -1);
    const prev1Start = shift(prev1End, -(winLen - 1));
    const prev2End   = shift(prev1Start, -1);
    const prev2Start = shift(prev2End, -(winLen - 1));

    const siteUrl = client.googleProperties.gscSiteUrl;

    // Prior-window position lookups (query → position). Failures degrade
    // gracefully to an empty map so the current period still renders.
    const positionMap = async (s: string, e: string): Promise<Map<string, number>> => {
      try {
        const rows = await fetchGscSummary(auth, siteUrl, s, e, ["query"]);
        return new Map(rows.filter(r => r.query).map(r => [r.query!, r.position]));
      } catch {
        return new Map();
      }
    };

    try {
      const [rows, prev1Map, prev2Map] = await Promise.all([
        fetchGscSummary(auth, siteUrl, startDate, endDate, ["query"]),
        positionMap(prev1Start, prev1End),
        positionMap(prev2Start, prev2End),
      ]);

      const keywords = rows
        .filter(r => r.query)
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 100)
        .map(r => ({
          query: r.query!,
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          position: r.position,
          prevPosition:  prev1Map.get(r.query!) ?? null,
          prev2Position: prev2Map.get(r.query!) ?? null,
        }));

      return NextResponse.json({ keywords });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  } catch (e) {
    return toResponse(e);
  }
}
