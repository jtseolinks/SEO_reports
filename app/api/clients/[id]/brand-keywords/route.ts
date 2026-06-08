import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgency, requireClientInAgency, toResponse } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

/**
 * PUT /api/clients/[id]/brand-keywords
 * Replaces the full brand-keyword exclusion list for a client.
 * Body: { keywords: string[] }
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgency();
    const { id } = await params;
    await requireClientInAgency(id, ctx.agencyId);

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
  } catch (e) {
    return toResponse(e);
  }
}
