import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
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
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.clientGoogleProperty.deleteMany({ where: { clientId: id } });
  return NextResponse.json({ success: true });
}
