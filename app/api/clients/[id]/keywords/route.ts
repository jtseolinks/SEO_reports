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

    try {
      const rows = await fetchGscSummary(
        auth,
        client.googleProperties.gscSiteUrl,
        startDate,
        endDate,
        ["query"]
      );

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
