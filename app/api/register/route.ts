import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { validatePassword } from "@/lib/password";

// Simple in-memory rate limiter: max 5 registrations per IP per hour.
const _reg: Map<string, { count: number; resetAt: number }> = new Map();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = _reg.get(ip);
  if (!entry || now > entry.resetAt) {
    _reg.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

/** Convert an agency name to a URL-safe slug and ensure uniqueness. */
async function uniqueSlug(base: string): Promise<string> {
  const slug = base
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48)
    || "agency";

  const existing = await prisma.agency.findMany({
    where: { slug: { startsWith: slug } },
    select: { slug: true },
  });
  if (!existing.find((a) => a.slug === slug)) return slug;

  // Append incrementing suffix until unique.
  for (let i = 2; i <= 99; i++) {
    const candidate = `${slug}-${i}`;
    if (!existing.find((a) => a.slug === candidate)) return candidate;
  }
  return `${slug}-${Date.now()}`;
}

export async function POST(req: NextRequest) {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "יותר מדי ניסיונות - אנא המתן שעה ונסה שוב" }, { status: 429 });
  }

  let body: { agencyName?: string; name?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { agencyName, name, email, password } = body;

  if (!agencyName?.trim()) return NextResponse.json({ error: "שם הסוכנות נדרש" }, { status: 400 });
  if (!email?.trim()) return NextResponse.json({ error: "אימייל נדרש" }, { status: 400 });
  if (!password) return NextResponse.json({ error: "סיסמה נדרשת" }, { status: 400 });
  const pwError = validatePassword(password);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "כתובת אימייל לא תקינה" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "כתובת האימייל כבר רשומה במערכת" }, { status: 409 });
  }

  const slug = await uniqueSlug(agencyName.trim());
  const passwordHash = await bcrypt.hash(password, 12);

  const { user } = await prisma.$transaction(async (tx) => {
    const agency = await tx.agency.create({
      data: { name: agencyName.trim(), slug },
    });
    const user = await tx.user.create({
      data: { name: name?.trim() || null, email: email.trim().toLowerCase(), passwordHash },
    });
    await tx.membership.create({
      data: { userId: user.id, agencyId: agency.id, role: "OWNER" },
    });
    return { user, agency };
  });

  return NextResponse.json({ userId: user.id }, { status: 201 });
}
