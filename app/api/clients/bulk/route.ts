import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgency, toResponse } from "@/lib/authz";

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAgency();
  } catch (e) {
    return toResponse(e);
  }

  const { ids, action }: { ids: string[]; action: "delete" | "activate" | "deactivate" } =
    await request.json();

  if (!ids?.length) return NextResponse.json({ error: "No ids provided" }, { status: 400 });

  // Every bulk op is constrained to the caller's agency, so ids belonging to
  // another tenant simply don't match and are no-ops.
  if (action === "delete") {
    const result = await prisma.client.deleteMany({ where: { id: { in: ids }, agencyId: ctx.agencyId } });
    return NextResponse.json({ affected: result.count });
  }

  if (action === "activate" || action === "deactivate") {
    const status = action === "activate" ? "ACTIVE" : "INACTIVE";
    const result = await prisma.client.updateMany({
      where: { id: { in: ids }, agencyId: ctx.agencyId },
      data: { status },
    });
    return NextResponse.json({ affected: result.count });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
