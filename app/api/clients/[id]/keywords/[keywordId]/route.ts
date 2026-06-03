import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; keywordId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { keywordId } = await params;
  await prisma.clientKeyword.delete({ where: { id: keywordId } });
  return NextResponse.json({ success: true });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { keywordId } = await params;
  const { groupName, isBrand, matchType, isActive } = await request.json();

  const kw = await prisma.clientKeyword.update({
    where: { id: keywordId },
    data: {
      ...(groupName !== undefined && { groupName }),
      ...(isBrand !== undefined && { isBrand }),
      ...(matchType !== undefined && { matchType }),
      ...(isActive !== undefined && { isActive }),
    },
  });
  return NextResponse.json(kw);
}
