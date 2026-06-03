import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedClient } from "@/lib/google-oauth";
import { fetchGscSummary } from "@/lib/gsc-api";

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
    return NextResponse.json({ error: "No GSC property" }, { status: 400 });
  }

  const auth = await getAuthenticatedClient();
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
}
