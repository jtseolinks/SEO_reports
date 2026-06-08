import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgency, toResponse } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgency();
    const { id } = await params;
    const report = await prisma.monthlyReport.findFirst({
      where: { id, agencyId: ctx.agencyId },
      include: { emailLogs: { orderBy: { createdAt: "desc" } } },
    });
    if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(report);
  } catch (e) {
    return toResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgency();
    const { id } = await params;
    // Scope the delete to the agency; count tells us whether it existed here.
    const result = await prisma.monthlyReport.deleteMany({ where: { id, agencyId: ctx.agencyId } });
    if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return toResponse(e);
  }
}
