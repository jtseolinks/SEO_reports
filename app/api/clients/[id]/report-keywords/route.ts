import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgency, requireClientInAgency, toResponse } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgency();
    const { id } = await params;
    await requireClientInAgency(id, ctx.agencyId);

    const rows = await prisma.clientKeyword.findMany({
      where: { clientId: id, isBrand: false, isActive: true },
      orderBy: { keyword: "asc" },
      select: { keyword: true },
    });

    return NextResponse.json({ keywords: rows.map(r => r.keyword) });
  } catch (e) {
    return toResponse(e);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgency();
    const { id } = await params;
    await requireClientInAgency(id, ctx.agencyId);

    const { keywords }: { keywords: string[] } = await request.json();
    if (!Array.isArray(keywords)) {
      return NextResponse.json({ error: "keywords must be an array" }, { status: 400 });
    }

    const unique = [...new Set(keywords.map(k => k.trim()).filter(Boolean))];

    await prisma.$transaction([
      prisma.clientKeyword.deleteMany({ where: { clientId: id, isBrand: false } }),
      ...unique.map(keyword =>
        prisma.clientKeyword.create({
          data: { clientId: id, keyword, isBrand: false, isActive: true, matchType: "CONTAINS" },
        })
      ),
    ]);

    return NextResponse.json({ keywords: unique });
  } catch (e) {
    return toResponse(e);
  }
}
