import { NextRequest, NextResponse } from "next/server";
import { requireAgencyAdmin, toResponse } from "@/lib/authz";
import { sendTestEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAgencyAdmin();
  } catch (e) {
    return toResponse(e);
  }

  const { to } = await request.json();
  if (!to) return NextResponse.json({ error: "to is required" }, { status: 400 });

  try {
    const messageId = await sendTestEmail(ctx.agencyId, to);
    return NextResponse.json({ success: true, messageId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Test email error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
