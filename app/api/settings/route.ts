import { NextRequest, NextResponse } from "next/server";
import { getAgencySettings, saveAgencySettings, maskSecrets } from "@/lib/agency-settings";
import { prisma } from "@/lib/prisma";
import { requireAgency, requireAgencyAdmin, toResponse } from "@/lib/authz";

export async function GET() {
  try {
    const ctx = await requireAgency();
    const settings = await getAgencySettings(ctx.agencyId);
    return NextResponse.json(maskSecrets(settings));
  } catch (e) {
    return toResponse(e);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ctx = await requireAgencyAdmin();
    const body = await request.json();
    const prevSettings = await getAgencySettings(ctx.agencyId);
    await saveAgencySettings(ctx.agencyId, body);

    // When defaultSendDay changes - update this agency's clients that don't have a custom send day
    if (body.defaultSendDay && body.defaultSendDay !== prevSettings.defaultSendDay) {
      const newDay = parseInt(body.defaultSendDay, 10);
      if (!isNaN(newDay) && newDay >= 1 && newDay <= 28) {
        await prisma.client.updateMany({
          where: { agencyId: ctx.agencyId, sendDayCustom: false },
          data:  { reportSendDay: newDay },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return toResponse(e);
  }
}
