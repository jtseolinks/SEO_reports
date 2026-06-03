import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const rows = await prisma.clientKeyword.findMany({
    where: { clientId: id, isBrand: false, isActive: true },
    orderBy: { keyword: "asc" },
    select: { keyword: true },
  });

  return NextResponse.json({ keywords: rows.map(r => r.keyword) });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
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
}
