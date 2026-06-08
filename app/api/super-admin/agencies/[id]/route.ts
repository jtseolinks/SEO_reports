import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, toResponse } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

// Edit agency name / slug.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const { name, slug } = (await req.json()) as { name?: string; slug?: string };

    if (slug) {
      const conflict = await prisma.agency.findFirst({ where: { slug, NOT: { id } } });
      if (conflict) return NextResponse.json({ error: "Slug כבר בשימוש" }, { status: 409 });
    }

    const agency = await prisma.agency.update({
      where: { id },
      data: { name: name?.trim() || undefined, slug: slug?.trim() || undefined },
    });
    return NextResponse.json({ agency });
  } catch (e) {
    return toResponse(e);
  }
}

// Delete agency and all its data (cascade via FK).
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    await prisma.agency.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return toResponse(e);
  }
}
