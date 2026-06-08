import { NextResponse } from "next/server";
import { acceptInvitation } from "@/lib/invitation";

// Simple in-memory rate limiter: max 10 attempts per IP per 15 min
const _attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = _attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    _attempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  if (entry.count >= 10) return true;
  entry.count++;
  return false;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "יותר מדי ניסיונות. נסה שוב בעוד 15 דקות." },
      { status: 429 }
    );
  }

  try {
    const { token, name, password } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "טוקן חסר" }, { status: 400 });
    }

    const userData =
      name && password
        ? { name: String(name).trim(), password: String(password) }
        : null;

    const result = await acceptInvitation(token, userData);
    return NextResponse.json({ ok: true, email: result.email });
  } catch (e) {
    if (e instanceof Error) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
