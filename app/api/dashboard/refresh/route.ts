import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedClient } from "@/lib/google-oauth";
import { fetchGscSummary, aggregateGsc } from "@/lib/gsc-api";
import { fetchGa4OrganicSummary } from "@/lib/ga4-api";

function periodDates(monthsAgo: number) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() - monthsAgo;
  const first = new Date(y, m, 1);
  const last  = new Date(y, m + 1, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${first.getFullYear()}-${pad(first.getMonth() + 1)}-01`,
    end:   `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
  };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await request.json();
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { googleProperties: true },
  });

  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!client.googleProperties?.gscSiteUrl) {
    return NextResponse.json({ connectionOk: false, error: "No GSC property" });
  }

  const { gscSiteUrl, ga4PropertyId } = client.googleProperties;
  const curr = periodDates(1); // last full month
  const prev = periodDates(2); // month before that

  try {
    const auth = await getAuthenticatedClient();
    if (!auth) return NextResponse.json({ connectionOk: false, error: "Google not connected" });

    const [currRows, prevRows, ga4] = await Promise.all([
      fetchGscSummary(auth, gscSiteUrl, curr.start, curr.end, ["query"]),
      fetchGscSummary(auth, gscSiteUrl, prev.start, prev.end, ["query"]),
      ga4PropertyId
        ? fetchGa4OrganicSummary(auth, ga4PropertyId, curr.start, curr.end)
        : Promise.resolve(null),
    ]);

    const c = aggregateGsc(currRows);
    const p = aggregateGsc(prevRows);
    const totalImp  = c.impressions || 1;
    const totalImpP = p.impressions || 1;

    return NextResponse.json({
      connectionOk: true,
      clicks:       c.clicks,
      impressions:  c.impressions,
      position:     c.totalPosWeight / totalImp,
      positionPrev: p.totalPosWeight / totalImpP,
      sessions:     ga4?.sessions ?? null,
    });
  } catch (err) {
    return NextResponse.json({
      connectionOk: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
