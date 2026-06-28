import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgencyAdmin, toResponse, HttpError } from "@/lib/authz";
import type { MembershipRole } from "@/lib/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

/**
 * Remove a member from the active agency.
 * - ADMIN: can only remove MEMBERs.
 * - OWNER: can remove ADMIN or MEMBER (not themselves, not the last OWNER).
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgencyAdmin();
    const { id } = await params; // userId

    if (id === ctx.userId) {
      return NextResponse.json({ error: "לא ניתן להסיר את עצמך" }, { status: 400 });
    }

    const target = await prisma.membership.findUnique({
      where: { userId_agencyId: { userId: id, agencyId: ctx.agencyId } },
    });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // ADMIN cannot remove other ADMINs or the OWNER.
    if (ctx.role !== "OWNER" && (target.role === "ADMIN" || target.role === "OWNER")) {
      throw new HttpError(403, "רק הבעלים יכול להסיר מנהלים");
    }

    // Prevent removing the last OWNER.
    if (target.role === "OWNER") {
      const ownerCount = await prisma.membership.count({
        where: { agencyId: ctx.agencyId, role: "OWNER" },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "לא ניתן להסיר את הבעלים האחרון של הסוכנות" },
          { status: 400 }
        );
      }
    }

    await prisma.membership.delete({
      where: { userId_agencyId: { userId: id, agencyId: ctx.agencyId } },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return toResponse(e);
  }
}

/**
 * Update a member: name/email on the user, role on the membership.
 * - Role changes (to/from ADMIN or OWNER): OWNER only.
 * - Name/email edits: OWNER or ADMIN.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgencyAdmin();
    const { id } = await params; // userId
    const { name, email, role } = (await req.json()) as {
      name?: string; email?: string; role?: string;
    };

    const membership = await prisma.membership.findUnique({
      where: { userId_agencyId: { userId: id, agencyId: ctx.agencyId } },
    });
    if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Role change rules - only OWNER can promote/demote.
    const newRole =
      role === "OWNER" || role === "ADMIN" || role === "MEMBER"
        ? (role as MembershipRole)
        : membership.role;

    if (newRole !== membership.role) {
      if (ctx.role !== "OWNER") {
        throw new HttpError(403, "רק הבעלים יכול לשנות תפקידים");
      }
      // Prevent demoting the last OWNER.
      if (membership.role === "OWNER" && newRole !== "OWNER") {
        const ownerCount = await prisma.membership.count({
          where: { agencyId: ctx.agencyId, role: "OWNER" },
        });
        if (ownerCount <= 1) {
          return NextResponse.json(
            { error: "לא ניתן לשנות תפקיד הבעלים האחרון - העבר בעלות תחילה" },
            { status: 400 }
          );
        }
      }
    }

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

    if (newRole !== membership.role) {
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
