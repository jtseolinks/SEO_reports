import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgency, toResponse } from "@/lib/authz";

type ImportSite = {
  siteUrl: string;
  name: string;
  ga4PropertyId: string;
  ga4PropertyName: string;
};

function deriveDomain(siteUrl: string): string {
  return siteUrl
    .replace(/^sc-domain:/, "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAgency();
  } catch (e) {
    return toResponse(e);
  }

  const { sites }: { sites: ImportSite[] } = await request.json();
  const results = [];

  for (const site of sites) {
    const domain = deriveDomain(site.siteUrl);

    // Duplicate check scoped to this agency only.
    const existing = await prisma.client.findFirst({ where: { domain, agencyId: ctx.agencyId } });
    if (existing) {
      results.push({ siteUrl: site.siteUrl, status: "skipped", reason: "Already exists" });
      continue;
    }

    const client = await prisma.client.create({
      data: {
        agencyId: ctx.agencyId,
        name: site.name || domain,
        domain,
        contactEmail: "",
        status: "ACTIVE",
        reportSendDay: 5,
        googleProperties: {
          create: {
            gscSiteUrl: site.siteUrl,
            ga4PropertyId: site.ga4PropertyId ?? "",
            ga4PropertyName: site.ga4PropertyName ?? "",
          },
        },
      },
    });

    results.push({ siteUrl: site.siteUrl, status: "created", clientId: client.id });
  }

  return NextResponse.json({ results });
}
