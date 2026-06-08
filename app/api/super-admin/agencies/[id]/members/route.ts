import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, toResponse } from "@/lib/authz";
import bcrypt from "bcryptjs";
import type { MembershipRole } from "@/lib/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

// List members of an agency.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const members = await prisma.membership.findMany({
      where: { agencyId: id },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, email: true, name: true, isSuperAdmin: true } } },
    });
    return NextResponse.json({
      members: members.map((m) => ({
        userId: m.user.id,
        email: m.user.email,
        name: m.user.name,
        role: m.role,
        isSuperAdmin: m.user.isSuperAdmin,
        createdAt: m.createdAt,
      })),
    });
  } catch (e) {
    return toResponse(e);
  }
}

// Add an existing user (by email) or create a new one, then add to agency.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireSuperAdmin();
    const { id: agencyId } = await params;
    const { email, name, password, role } = (await req.json()) as {
      email: string; name?: string; password?: string; role?: string;
    };

    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const assignedRole: MembershipRole =
      role === "OWNER" || role === "ADMIN" || role === "MEMBER" ? (role as MembershipRole) : "MEMBER";

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      if (!password || password.length < 8) {
        return NextResponse.json({ error: "New user requires password (min 8 chars)" }, { status: 400 });
      }
      user = await prisma.user.create({
        data: { email, name: name?.trim() || null, passwordHash: await bcrypt.hash(password, 12) },
      });
    }

    const existing = await prisma.membership.findUnique({
      where: { userId_agencyId: { userId: user.id, agencyId } },
    });
    if (existing) return NextResponse.json({ error: "המשתמש כבר חבר בסוכנות" }, { status: 409 });

    await prisma.membership.create({ data: { userId: user.id, agencyId, role: assignedRole } });
    return NextResponse.json({ userId: user.id, email: user.email, role: assignedRole }, { status: 201 });
  } catch (e) {
    return toResponse(e);
  }
}
