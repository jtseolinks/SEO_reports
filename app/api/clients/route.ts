import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgency, toResponse } from "@/lib/authz";

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

  const client = await prisma.client.create({
    data: {
      agencyId: ctx.agencyId,
      name,
      domain,
      contactEmail,
      ccEmails: ccEmails ?? [],
      reportSendDay: reportSendDay ?? 5,
      notes: notes ?? null,
    },
  });

  return NextResponse.json(client, { status: 201 });
}
