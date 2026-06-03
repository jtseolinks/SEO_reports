import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clients = await prisma.client.findMany({
    include: { googleProperties: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(clients);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, domain, contactEmail, ccEmails, reportSendDay, notes } = body;

  if (!name || !domain || !contactEmail) {
    return NextResponse.json({ error: "name, domain, and contactEmail are required" }, { status: 400 });
  }

  const client = await prisma.client.create({
    data: {
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
