import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgencyAdmin, toResponse } from "@/lib/authz";
import type { MembershipRole } from "@/lib/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

// Remove a member from the active agency (does not delete the global user).
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgencyAdmin();
    const { id } = await params; // userId

    if (id === ctx.userId) {
      return NextResponse.json({ error: "לא ניתן להסיר את עצמך" }, { status: 400 });
    }

    const result = await prisma.membership.deleteMany({
      where: { userId: id, agencyId: ctx.agencyId },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return toResponse(e);
  }
}

// Update a member: name/email on the user, role on the membership (scoped to agency).
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgencyAdmin();
    const { id } = await params; // userId
    const { name, email, role } = (await req.json()) as {
      name?: string; email?: string; role?: string;
    };

    // The target must be a member of the active agency.
    const membership = await prisma.membership.findUnique({
      where: { userId_agencyId: { userId: id, agencyId: ctx.agencyId } },
    });
    if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (email) {
      const conflict = await prisma.user.findUnique({ where: { email } });
      if (conflict && conflict.id !== id) {
        return NextResponse.json({ error: "כתובת האימייל כבר בשימוש" }, { status: 400 });
      }
    }

    if (name !== undefined || email !== undefined) {
      await prisma.user.update({
        where: { id },
        data: { name: name ?? undefined, email: email ?? undefined },
      });
    }

    let newRole = membership.role;
    if (role === "OWNER" || role === "ADMIN" || role === "MEMBER") {
      newRole = role as MembershipRole;
      await prisma.membership.update({
        where: { userId_agencyId: { userId: id, agencyId: ctx.agencyId } },
        data: { role: newRole },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    return NextResponse.json({ user: { ...user, role: newRole } });
  } catch (e) {
    return toResponse(e);
  }
}
