import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgency, requireClientInAgency, toResponse } from "@/lib/authz";

type Params = { params: Promise<{ id: string; keywordId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgency();
    const { id, keywordId } = await params;
    await requireClientInAgency(id, ctx.agencyId);
    // Scope by clientId so a keywordId from another client can't be deleted.
    await prisma.clientKeyword.deleteMany({ where: { id: keywordId, clientId: id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return toResponse(e);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgency();
    const { id, keywordId } = await params;
    await requireClientInAgency(id, ctx.agencyId);

    const { groupName, isBrand, matchType, isActive } = await request.json();

    const result = await prisma.clientKeyword.updateMany({
      where: { id: keywordId, clientId: id },
      data: {
        ...(groupName !== undefined && { groupName }),
        ...(isBrand !== undefined && { isBrand }),
        ...(matchType !== undefined && { matchType }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return toResponse(e);
  }
}
