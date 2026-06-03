import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

/**
 * PUT /api/clients/[id]/brand-keywords
 * Replaces the full brand-keyword exclusion list for a client.
 * Body: { keywords: string[] }
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { keywords } = (await request.json()) as { keywords: string[] };

  if (!Array.isArray(keywords)) {
    return NextResponse.json({ error: "keywords must be an array" }, { status: 400 });
  }

  // Atomically replace all brand keywords for this client
  await prisma.$transaction(async (tx) => {
    await tx.clientKeyword.deleteMany({ where: { clientId: id, isBrand: true } });
    if (keywords.length > 0) {
      await tx.clientKeyword.createMany({
        data: keywords.map((kw) => ({
          clientId: id,
          keyword: kw,
          isBrand: true,
          isActive: true,
        })),
        skipDuplicates: true,
      });
    }
  });

  return NextResponse.json({ success: true });
}
