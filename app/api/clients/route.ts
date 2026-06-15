import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgency, toResponse } from "@/lib/authz";
import { getAgencySettings } from "@/lib/agency-settings";
import { parseDefaultSendDay } from "@/lib/schedule";

export async function GET() {
  let ctx;
  try {
    ctx = await requireAgency();
  } catch (e) {
    return toResponse(e);
  }

  const clients = await prisma.client.findMany({
    where: { agencyId: ctx.agencyId },
    include: { googleProperties: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(clients);
}

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAgency();
  } catch (e) {
    return toResponse(e);
  }

  const body = await request.json();
  const { name, domain, contactEmail, ccEmails, reportSendDay, notes } = body;

  if (!name || !domain || !contactEmail) {
    return NextResponse.json({ error: "name, domain, and contactEmail are required" }, { status: 400 });
  }

  // New clients follow the agency's global default send day unless an explicit,
  // different day is requested — in which case it's a per-client override.
  const defaultSendDay = parseDefaultSendDay((await getAgencySettings(ctx.agencyId)).defaultSendDay);
  const requestedDay = reportSendDay != null ? parseInt(String(reportSendDay), 10) : null;
  const isCustomDay = requestedDay != null && !isNaN(requestedDay) && requestedDay !== defaultSendDay;

  const client = await prisma.client.create({
    data: {
      agencyId: ctx.agencyId,
      name,
      domain,
      contactEmail,
      ccEmails: ccEmails ?? [],
      reportSendDay: isCustomDay ? requestedDay : defaultSendDay,
      sendDayCustom: isCustomDay,
      notes: notes ?? null,
    },
  });

  return NextResponse.json(client, { status: 201 });
}
