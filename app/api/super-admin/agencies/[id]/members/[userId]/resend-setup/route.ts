import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, toResponse } from "@/lib/authz";
import { createSetupToken } from "@/lib/setup-token";
import { sendMemberInviteEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string; userId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    await requireSuperAdmin();
    const { id: agencyId, userId } = await params;

    const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } });
    if (!agency) return NextResponse.json({ error: "סוכנות לא נמצאה" }, { status: 404 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!user) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
    if (user.passwordHash) {
      return NextResponse.json({ error: "המשתמש כבר הגדיר סיסמא" }, { status: 400 });
    }

    // Verify membership
    const membership = await prisma.membership.findUnique({
      where: { userId_agencyId: { userId, agencyId } },
    });
    if (!membership) return NextResponse.json({ error: "המשתמש אינו חבר בסוכנות" }, { status: 404 });

    const rawToken = await createSetupToken(userId, agencyId);
    const baseUrl = (process.env.NEXTAUTH_URL || process.env.APP_URL || "").replace(/\/$/, "");
    const setupUrl = `${baseUrl}/onboard/${rawToken}`;

    let emailSent = false;
    try {
      await sendMemberInviteEmail(user.email, agency.name, setupUrl);
      emailSent = true;
    } catch (err) {
      console.error("[resend member setup email]", err);
    }

    return NextResponse.json({ emailSent, setupUrl: emailSent ? undefined : setupUrl });
  } catch (e) {
    return toResponse(e);
  }
}
