import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgency, toResponse } from "@/lib/authz";

/**
 * Switch the caller's active agency. Verifies membership, persists the choice
 * on the user, then the client must call NextAuth `update({ agencyId })` to
 * re-issue the JWT with the new active agency (handled in the jwt callback).
 */
export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAgency();
  } catch (e) {
    return toResponse(e);
  }

  const { agencyId } = await request.json();
  if (!agencyId || typeof agencyId !== "string") {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_agencyId: { userId: ctx.userId, agencyId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member of that workspace" }, { status: 403 });
  }

  await prisma.user.update({
    where: { id: ctx.userId },
    data: { lastActiveAgencyId: agencyId },
  });

  return NextResponse.json({ success: true, agencyId, role: membership.role });
}
