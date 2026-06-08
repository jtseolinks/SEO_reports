import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAgencyAdmin, toResponse } from "@/lib/authz";
import type { MembershipRole } from "@/lib/generated/prisma/client";

function toMembershipRole(role?: string): MembershipRole {
  return role === "OWNER" || role === "ADMIN" || role === "MEMBER"
    ? (role as MembershipRole)
    : "MEMBER";
}

// List the members of the active agency.
export async function GET() {
  try {
    const ctx = await requireAgencyAdmin();
    const members = await prisma.membership.findMany({
      where: { agencyId: ctx.agencyId },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, email: true, name: true, createdAt: true } } },
    });
    const users = members.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      createdAt: m.user.createdAt,
    }));
    return NextResponse.json({ users });
  } catch (e) {
    return toResponse(e);
  }
}

// Add a member to the active agency (creating the user if they don't exist yet).
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAgencyAdmin();
    const { name, email, password, role } = (await req.json()) as {
      name: string; email: string; password: string; role?: string;
    };

    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      if (!password) {
        return NextResponse.json({ error: "password required for a new user" }, { status: 400 });
      }
      user = await prisma.user.create({
        data: { name: name || null, email, passwordHash: await bcrypt.hash(password, 12) },
      });
    }

    const existingMembership = await prisma.membership.findUnique({
      where: { userId_agencyId: { userId: user.id, agencyId: ctx.agencyId } },
    });
    if (existingMembership) {
      return NextResponse.json({ error: "המשתמש כבר חבר בארגון" }, { status: 409 });
    }

    await prisma.membership.create({
      data: { userId: user.id, agencyId: ctx.agencyId, role: toMembershipRole(role) },
    });

    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name, role: toMembershipRole(role) } },
      { status: 201 }
    );
  } catch (e) {
    return toResponse(e);
  }
}
