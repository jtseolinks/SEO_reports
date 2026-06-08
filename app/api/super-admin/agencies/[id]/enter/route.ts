import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, toResponse } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/super-admin/agencies/[id]/enter
 * Lets a super-admin "enter" any agency workspace (no membership required).
 * Updates lastActiveAgencyId so the subsequent update({ agencyId }) JWT trigger
 * picks up the right agency on the next load too.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireSuperAdmin();
    const { id: agencyId } = await params;

    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: { id: true, name: true },
    });
    if (!agency) return NextResponse.json({ error: "סוכנות לא נמצאה" }, { status: 404 });

    return NextResponse.json({ success: true, agencyId, agencyName: agency.name });
  } catch (e) {
    return toResponse(e);
  }
}
