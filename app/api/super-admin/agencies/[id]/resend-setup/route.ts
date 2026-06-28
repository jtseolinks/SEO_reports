import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, toResponse } from "@/lib/authz";
import { createSetupToken } from "@/lib/setup-token";
import { sendOnboardingEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    await requireSuperAdmin();
    const { id: agencyId } = await params;

    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: { name: true },
    });
    if (!agency) return NextResponse.json({ error: "סוכנות לא נמצאה" }, { status: 404 });

    // Find OWNER membership
    const ownerMembership = await prisma.membership.findFirst({
      where: { agencyId, role: "OWNER" },
      include: { user: { select: { id: true, email: true, passwordHash: true } } },
    });
    if (!ownerMembership) {
      return NextResponse.json({ error: "אין בעלים לסוכנות" }, { status: 400 });
    }
    if (ownerMembership.user.passwordHash) {
      return NextResponse.json({ error: "הבעלים כבר הגדיר סיסמא - ההגדרה הושלמה" }, { status: 400 });
    }

    const rawToken = await createSetupToken(ownerMembership.user.id, agencyId);
    const baseUrl = (process.env.NEXTAUTH_URL || process.env.APP_URL || "").replace(/\/$/, "");
    const setupUrl = `${baseUrl}/onboard/${rawToken}`;

    let emailSent = false;
    try {
      await sendOnboardingEmail(ownerMembership.user.email, agency.name, setupUrl);
      emailSent = true;
    } catch (err) {
      console.error("[resend setup email]", err);
    }

    return NextResponse.json({
      emailSent,
      setupUrl: emailSent ? undefined : setupUrl,
    });
  } catch (e) {
    return toResponse(e);
  }
}
