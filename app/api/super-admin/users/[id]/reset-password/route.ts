import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, toResponse } from "@/lib/authz";
import { createSetupToken } from "@/lib/setup-token";
import { sendPasswordResetEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    await requireSuperAdmin();
    const { id: userId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });

    // Need an agencyId for the token - pick the user's first membership.
    const membership = await prisma.membership.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { agencyId: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "המשתמש אינו משויך לסוכנות" }, { status: 400 });
    }

    const rawToken = await createSetupToken(userId, membership.agencyId);
    const baseUrl = (process.env.NEXTAUTH_URL || process.env.APP_URL || "").replace(/\/$/, "");
    const resetUrl = `${baseUrl}/onboard/${rawToken}`;

    let emailSent = false;
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
      emailSent = true;
    } catch (err) {
      console.error("[reset-password email]", err);
    }

    return NextResponse.json({ emailSent, resetUrl: emailSent ? undefined : resetUrl });
  } catch (e) {
    return toResponse(e);
  }
}
