import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, toResponse } from "@/lib/authz";
import type { MembershipRole } from "@/lib/generated/prisma/client";

type Params = { params: Promise<{ id: string; userId: string }> };

// Change membership role.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireSuperAdmin();
    const { id: agencyId, userId } = await params;
    const { role } = (await req.json()) as { role?: string };

    const newRole: MembershipRole =
      role === "OWNER" || role === "ADMIN" || role === "MEMBER" ? (role as MembershipRole) : "MEMBER";

    const m = await prisma.membership.update({
      where: { userId_agencyId: { userId, agencyId } },
      data: { role: newRole },
    });
    return NextResponse.json({ role: m.role });
  } catch (e) {
    return toResponse(e);
  }
}

// Remove member from agency.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireSuperAdmin();
    const { id: agencyId, userId } = await params;
    await prisma.membership.delete({ where: { userId_agencyId: { userId, agencyId } } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return toResponse(e);
  }
}
