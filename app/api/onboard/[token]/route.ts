import { NextRequest, NextResponse } from "next/server";
import { getSetupToken, consumeSetupToken } from "@/lib/setup-token";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

type Params = { params: Promise<{ token: string }> };

// GET — validate token and return metadata (no sensitive info)
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const data = await getSetupToken(token);
  if (!data) return NextResponse.json({ error: "קישור לא תקין" }, { status: 404 });
  if (data.expired) return NextResponse.json({ error: "הקישור פג תוקף" }, { status: 410 });
  if (data.used) return NextResponse.json({ error: "הקישור כבר נוצל" }, { status: 410 });

  return NextResponse.json({
    agencyName: data.agencyName,
    email: data.email,
    hasPassword: data.hasPassword,
    tokenId: data.id,
  });
}

// POST — step operations during wizard
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const data = await getSetupToken(token);
  if (!data) return NextResponse.json({ error: "קישור לא תקין" }, { status: 404 });
  if (data.expired) return NextResponse.json({ error: "הקישור פג תוקף" }, { status: 410 });

  const body = (await req.json()) as {
    step: "password" | "agency-details" | "complete";
    password?: string;
    name?: string;
    agencyDisplayName?: string;
  };

  // Step 1 — set password (required before anything else)
  if (body.step === "password") {
    if (!body.password || body.password.length < 8) {
      return NextResponse.json({ error: "סיסמא חייבת להכיל לפחות 8 תווים" }, { status: 400 });
    }
    const hash = await bcrypt.hash(body.password, 12);
    await prisma.user.update({
      where: { id: data.userId },
      data: {
        passwordHash: hash,
        ...(body.name?.trim() ? { name: body.name.trim() } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  }

  // Step 2 — optional agency details
  if (body.step === "agency-details") {
    if (body.agencyDisplayName?.trim()) {
      await prisma.agencySetting.upsert({
        where: { agencyId_key: { agencyId: data.agencyId, key: "agencyName" } },
        create: { agencyId: data.agencyId, key: "agencyName", value: body.agencyDisplayName.trim() },
        update: { value: body.agencyDisplayName.trim() },
      });
    }
    return NextResponse.json({ ok: true });
  }

  // complete — mark token used
  if (body.step === "complete") {
    if (!data.used) await consumeSetupToken(data.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown step" }, { status: 400 });
}
