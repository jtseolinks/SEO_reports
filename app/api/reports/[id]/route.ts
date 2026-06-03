import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const report = await prisma.monthlyReport.findUnique({
    where: { id },
    include: { emailLogs: { orderBy: { createdAt: "desc" } } },
  });

  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(report);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const report = await prisma.monthlyReport.findUnique({ where: { id }, select: { id: true } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.monthlyReport.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
