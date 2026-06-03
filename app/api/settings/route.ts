import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAgencySettings, saveAgencySettings } from "@/lib/agency-settings";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await getAgencySettings();
  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const prevSettings = await getAgencySettings();
  await saveAgencySettings(body);

  // When defaultSendDay changes — update all clients that don't have a custom send day
  if (body.defaultSendDay && body.defaultSendDay !== prevSettings.defaultSendDay) {
    const newDay = parseInt(body.defaultSendDay, 10);
    if (!isNaN(newDay) && newDay >= 1 && newDay <= 28) {
      await prisma.client.updateMany({
        where: { sendDayCustom: false },
        data:  { reportSendDay: newDay },
      });
    }
  }

  return NextResponse.json({ success: true });
}
