import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, toResponse } from "@/lib/authz";
import { sendPlatformTestEmail } from "@/lib/email";

// Send a test email through the platform SMTP transport. Super-admin only.
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();
  } catch (e) {
    return toResponse(e);
  }

  const { to } = await request.json();
  if (!to) return NextResponse.json({ error: "נדרשת כתובת יעד" }, { status: 400 });

  try {
    const messageId = await sendPlatformTestEmail(to);
    return NextResponse.json({ success: true, messageId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Platform test email error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
