import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgencyAdmin, toResponse, HttpError } from "@/lib/authz";
import { createSetupToken } from "@/lib/setup-token";
import { sendPasswordResetEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

// Agency ADMIN/OWNER resets a password for a member of THEIR agency. Sends a
// reset link; the member chooses a new (policy-checked) password via /onboard.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgencyAdmin();
    const { id: userId } = await params;

    // The target must be a member of the caller's agency (scopes the action).
    const membership = await prisma.membership.findUnique({
      where: { userId_agencyId: { userId, agencyId: ctx.agencyId } },
      include: { user: { select: { email: true } } },
    });
    if (!membership) {
      return NextResponse.json({ error: "המשתמש אינו חבר בסוכנות" }, { status: 404 });
    }
    // An ADMIN may not reset an OWNER's password — only another OWNER can.
    if (membership.role === "OWNER" && ctx.role !== "OWNER") {
      throw new HttpError(403, "רק הבעלים יכול לאפס סיסמת בעלים");
    }

    const rawToken = await createSetupToken(userId, ctx.agencyId);
    const baseUrl = (process.env.NEXTAUTH_URL || process.env.APP_URL || "").replace(/\/$/, "");
    const resetUrl = `${baseUrl}/onboard/${rawToken}`;

    let emailSent = false;
    try {
      await sendPasswordResetEmail(membership.user.email, resetUrl);
      emailSent = true;
    } catch (err) {
      console.error("[member reset-password email]", err);
    }

    return NextResponse.json({ emailSent, resetUrl: emailSent ? undefined : resetUrl });
  } catch (e) {
    return toResponse(e);
  }
}
