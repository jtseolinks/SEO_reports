import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgency, requireClientInAgency, toResponse } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgency();
    const { id } = await params;
    await requireClientInAgency(id, ctx.agencyId);

    const body = await request.json();
    const { gscSiteUrl, ga4PropertyId, ga4PropertyName } = body;

    if (!gscSiteUrl) {
      return NextResponse.json({ error: "gscSiteUrl is required" }, { status: 400 });
    }

    const props = await prisma.clientGoogleProperty.upsert({
      where: { clientId: id },
      create: { clientId: id, gscSiteUrl, ga4PropertyId: ga4PropertyId ?? "", ga4PropertyName: ga4PropertyName ?? null },
      update: { gscSiteUrl, ga4PropertyId: ga4PropertyId ?? "", ga4PropertyName: ga4PropertyName ?? null },
    });

    return NextResponse.json(props);
  } catch (e) {
    return toResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgency();
    const { id } = await params;
    await requireClientInAgency(id, ctx.agencyId);
    await prisma.clientGoogleProperty.deleteMany({ where: { clientId: id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return toResponse(e);
  }
}
