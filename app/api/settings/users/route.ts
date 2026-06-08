import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgencyAdmin, requireAgency, toResponse, HttpError } from "@/lib/authz";
import { createSetupToken } from "@/lib/setup-token";
import { sendMemberInviteEmail } from "@/lib/email";
import type { MembershipRole } from "@/lib/generated/prisma/client";

function toMembershipRole(role?: string): MembershipRole {
  return role === "OWNER" || role === "ADMIN" || role === "MEMBER"
    ? (role as MembershipRole)
    : "MEMBER";
}

// List members of the active agency.
export async function GET() {
  try {
    const ctx = await requireAgency();
    const members = await prisma.membership.findMany({
      where: { agencyId: ctx.agencyId },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true, email: true, name: true, createdAt: true,
            passwordHash: true,
            setupTokens: {
              where: { agencyId: ctx.agencyId },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { expiresAt: true, usedAt: true },
            },
          },
        },
      },
    });

    const now = new Date();
    const users = members.map((m) => {
      const u = m.user;
      const token = u.setupTokens[0] ?? null;
      let setupStatus: "complete" | "pending" | "expired" | "none";
      if (u.passwordHash) {
        setupStatus = "complete";
      } else if (!token) {
        setupStatus = "none";
      } else if (token.expiresAt < now) {
        setupStatus = "expired";
      } else {
        setupStatus = "pending";
      }
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: m.role,
        createdAt: u.createdAt,
        setupStatus,
      };
    });
    return NextResponse.json({ users });
  } catch (e) {
    return toResponse(e);
  }
}

// Invite a new member — sends setup email, no password needed.
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAgencyAdmin();
    const { email, role } = (await req.json()) as { email: string; role?: string };

    if (!email?.trim()) return NextResponse.json({ error: "email נדרש" }, { status: 400 });
    const emailLower = email.trim().toLowerCase();

    const assignedRole = toMembershipRole(role);
    if (assignedRole === "OWNER" && ctx.role !== "OWNER") {
      throw new HttpError(403, "רק הבעלים יכול להוסיף בעלים");
    }

    const agency = await prisma.agency.findUnique({
      where: { id: ctx.agencyId },
      select: { name: true },
    });

    let user = await prisma.user.findUnique({ where: { email: emailLower } });
    const isNew = !user;
    if (!user) {
      user = await prisma.user.create({ data: { email: emailLower } });
    }

    const existingMembership = await prisma.membership.findUnique({
      where: { userId_agencyId: { userId: user.id, agencyId: ctx.agencyId } },
    });
    if (existingMembership) {
      return NextResponse.json({ error: "המשתמש כבר חבר בסוכנות" }, { status: 409 });
    }

    await prisma.membership.create({
      data: { userId: user.id, agencyId: ctx.agencyId, role: assignedRole },
    });

    // Send invite if user has no password yet
    const needsSetup = isNew || !user.passwordHash;
    let emailSent = false;
    let setupUrl: string | undefined;

    if (needsSetup) {
      const rawToken = await createSetupToken(user.id, ctx.agencyId);
      const baseUrl = (process.env.NEXTAUTH_URL || process.env.APP_URL || "").replace(/\/$/, "");
      setupUrl = `${baseUrl}/onboard/${rawToken}`;
      try {
        await sendMemberInviteEmail(emailLower, agency?.name ?? "", setupUrl);
        emailSent = true;
        setupUrl = undefined;
      } catch (err) {
        console.error("[member invite email]", err);
      }
    }

    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name, role: assignedRole }, emailSent, setupUrl },
      { status: 201 }
    );
  } catch (e) {
    return toResponse(e);
  }
}
