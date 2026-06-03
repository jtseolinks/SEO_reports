import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sites }: { sites: ImportSite[] } = await request.json();
  const results = [];

  for (const site of sites) {
    const domain = deriveDomain(site.siteUrl);

    const existing = await prisma.client.findFirst({ where: { domain } });
    if (existing) {
      results.push({ siteUrl: site.siteUrl, status: "skipped", reason: "Already exists" });
      continue;
    }

    const client = await prisma.client.create({
      data: {
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
