export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAgencyAdmin, toResponse } from "@/lib/authz";
import { createInvitation, listInvitations } from "@/lib/invitation";
import { sendInvitationEmail } from "@/lib/email";
import type { MembershipRole } from "@/lib/generated/prisma/client";

export async function GET() {
  try {
    const ctx = await requireAgencyAdmin();
    const invitations = await listInvitations(ctx.agencyId);
    return NextResponse.json({ invitations });
  } catch (e) {
    return toResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAgencyAdmin();
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    const role = (body.role ?? "MEMBER") as MembershipRole;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "כתובת אימייל לא תקינה" }, { status: 400 });
    }
    if (!["OWNER", "ADMIN", "MEMBER"].includes(role)) {
      return NextResponse.json({ error: "תפקיד לא תקין" }, { status: 400 });
    }

    const token = await createInvitation(ctx.agencyId, ctx.userId, email, role);
    const baseUrl = (process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
    const inviteUrl = `${baseUrl}/invite/${token}`;

    let emailSent = false;
    try {
      await sendInvitationEmail(ctx.agencyId, email, ctx.email, inviteUrl);
      emailSent = true;
    } catch (err) {
      console.error("[invite] email send failed:", err);
    }

    return NextResponse.json({ ok: true, inviteUrl, emailSent });
  } catch (e) {
    return toResponse(e);
  }
}
