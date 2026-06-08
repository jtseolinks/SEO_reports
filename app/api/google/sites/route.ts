import { NextResponse } from "next/server";
import { requireAgency, toResponse } from "@/lib/authz";
import { getAuthenticatedClient } from "@/lib/google-oauth";
import { listGscSites } from "@/lib/gsc-api";
import { listGa4Properties } from "@/lib/ga4-api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let ctx;
  try {
    ctx = await requireAgency();
  } catch (e) {
    return toResponse(e);
  }

  try {
    const auth = await getAuthenticatedClient(ctx.agencyId);
    if (!auth) return NextResponse.json({ error: "Google not connected" }, { status: 400 });

    const [sites, ga4Properties, existingClients, existingProperties] = await Promise.all([
      listGscSites(auth),
      listGa4Properties(auth),
      prisma.client.findMany({ where: { agencyId: ctx.agencyId }, select: { domain: true } }),
      prisma.clientGoogleProperty.findMany({
        where: { client: { agencyId: ctx.agencyId } },
        select: { gscSiteUrl: true },
      }),
    ]);

    // Build a set of already-imported identifiers (domain + gscSiteUrl)
    const existingDomains  = new Set(existingClients.map(c => c.domain.replace(/^www\./, "").toLowerCase()));
    const existingSiteUrls = new Set(existingProperties.map(p => p.gscSiteUrl));

    return NextResponse.json({ sites, ga4Properties, existingDomains: [...existingDomains], existingSiteUrls: [...existingSiteUrls] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
