import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, toResponse } from "@/lib/authz";
import { createSetupToken } from "@/lib/setup-token";
import { sendMemberInviteEmail } from "@/lib/email";
import type { MembershipRole } from "@/lib/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

// List members of an agency with per-member setup status.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireSuperAdmin();
    const { id } = await params;

    const members = await prisma.membership.findMany({
      where: { agencyId: id },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true, email: true, name: true, isSuperAdmin: true, passwordHash: true,
            setupTokens: {
              where: { agencyId: id },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { expiresAt: true, usedAt: true },
            },
          },
        },
      },
    });

    const now = new Date();
    return NextResponse.json({
      members: members.map((m) => {
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
          userId: u.id,
          email: u.email,
          name: u.name,
          role: m.role,
          isSuperAdmin: u.isSuperAdmin,
          createdAt: m.createdAt,
          setupStatus,
        };
      }),
    });
  } catch (e) {
    return toResponse(e);
  }
}

// Add a user (existing or new) to an agency - sends setup email if new user or no password yet.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireSuperAdmin();
    const { id: agencyId } = await params;
    const { email, role } = (await req.json()) as { email: string; role?: string };

    if (!email?.trim()) return NextResponse.json({ error: "email נדרש" }, { status: 400 });

    const emailLower = email.trim().toLowerCase();
    const assignedRole: MembershipRole =
      role === "OWNER" || role === "ADMIN" || role === "MEMBER" ? (role as MembershipRole) : "MEMBER";

    const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } });
    if (!agency) return NextResponse.json({ error: "סוכנות לא נמצאה" }, { status: 404 });

    // Find or create user (no password - they'll set it via setup link)
    let user = await prisma.user.findUnique({ where: { email: emailLower } });
    const isNewUser = !user;
    if (!user) {
      user = await prisma.user.create({ data: { email: emailLower } });
    }

    // Check already member
    const existing = await prisma.membership.findUnique({
      where: { userId_agencyId: { userId: user.id, agencyId } },
    });
    if (existing) return NextResponse.json({ error: "המשתמש כבר חבר בסוכנות" }, { status: 409 });

    await prisma.membership.create({ data: { userId: user.id, agencyId, role: assignedRole } });

    // Send setup email if user has no password yet (new user or existing without password)
    const needsSetup = isNewUser || !user.passwordHash;
    let emailSent = false;
    let setupUrl: string | undefined;

    if (needsSetup) {
      const rawToken = await createSetupToken(user.id, agencyId);
      const baseUrl = (process.env.NEXTAUTH_URL || process.env.APP_URL || "").replace(/\/$/, "");
      setupUrl = `${baseUrl}/onboard/${rawToken}`;
      try {
        await sendMemberInviteEmail(emailLower, agency.name, setupUrl);
        emailSent = true;
        setupUrl = undefined; // don't expose if email worked
      } catch (err) {
        console.error("[member onboarding email]", err);
      }
    }

    return NextResponse.json(
      { userId: user.id, email: user.email, role: assignedRole, emailSent, setupUrl },
      { status: 201 }
    );
  } catch (e) {
    return toResponse(e);
  }
}
