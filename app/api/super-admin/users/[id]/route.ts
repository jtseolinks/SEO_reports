import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, toResponse } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

// Toggle isSuperAdmin or update name.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireSuperAdmin();
    const { id } = await params;

    // Prevent revoking own super-admin.
    if (id === ctx.userId) {
      const body = (await req.json()) as { isSuperAdmin?: boolean };
      if (body.isSuperAdmin === false) {
        return NextResponse.json({ error: "לא ניתן להסיר הרשאת super-admin מעצמך" }, { status: 400 });
      }
    }

    const { isSuperAdmin, name, email, membershipRole } = (await req.json().catch(() => ({}))) as {
      isSuperAdmin?: boolean;
      name?: string;
      email?: string;
      membershipRole?: string;
    };

    // Email uniqueness check
    if (email?.trim()) {
      const emailLower = email.trim().toLowerCase();
      const conflict = await prisma.user.findUnique({ where: { email: emailLower } });
      if (conflict && conflict.id !== id) {
        return NextResponse.json({ error: "כתובת המייל כבר בשימוש" }, { status: 409 });
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        isSuperAdmin: isSuperAdmin !== undefined ? isSuperAdmin : undefined,
        name: name !== undefined ? name?.trim() || null : undefined,
        email: email?.trim() ? email.trim().toLowerCase() : undefined,
      },
      select: { id: true, email: true, name: true, isSuperAdmin: true },
    });

    // Update all membership roles if requested
    if (membershipRole === "OWNER" || membershipRole === "ADMIN" || membershipRole === "MEMBER") {
      await prisma.membership.updateMany({
        where: { userId: id },
        data: { role: membershipRole },
      });
    }

    return NextResponse.json({ user });
  } catch (e) {
    return toResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireSuperAdmin();
    const { id } = await params;

    if (id === ctx.userId) {
      return NextResponse.json({ error: "לא ניתן למחוק את עצמך" }, { status: 400 });
    }

    // Cascade: memberships, setupTokens deleted via onDelete: Cascade in schema.
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return toResponse(e);
  }
}
