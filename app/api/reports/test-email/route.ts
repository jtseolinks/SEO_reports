import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendTestEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { to } = await request.json();
  if (!to) return NextResponse.json({ error: "to is required" }, { status: 400 });

  try {
    const messageId = await sendTestEmail(to);
    return NextResponse.json({ success: true, messageId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Test email error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
