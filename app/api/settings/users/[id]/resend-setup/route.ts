import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgencyAdmin, toResponse } from "@/lib/authz";
import { createSetupToken } from "@/lib/setup-token";
import { sendMemberInviteEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgencyAdmin();
    const { id: userId } = await params;

    const membership = await prisma.membership.findUnique({
      where: { userId_agencyId: { userId, agencyId: ctx.agencyId } },
    });
    if (!membership) return NextResponse.json({ error: "משתמש לא נמצא בסוכנות" }, { status: 404 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, passwordHash: true },
    });
    if (!user) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
    if (user.passwordHash) return NextResponse.json({ error: "המשתמש כבר הגדיר סיסמא" }, { status: 400 });

    const agency = await prisma.agency.findUnique({
      where: { id: ctx.agencyId },
      select: { name: true },
    });

    const rawToken = await createSetupToken(userId, ctx.agencyId);
    const baseUrl = (process.env.NEXTAUTH_URL || process.env.APP_URL || "").replace(/\/$/, "");
    const setupUrl = `${baseUrl}/onboard/${rawToken}`;

    let emailSent = false;
    try {
      await sendMemberInviteEmail(user.email, agency?.name ?? "", setupUrl);
      emailSent = true;
    } catch (err) {
      console.error("[resend member setup]", err);
    }

    return NextResponse.json({ emailSent, setupUrl: emailSent ? undefined : setupUrl });
  } catch (e) {
    return toResponse(e);
  }
}
