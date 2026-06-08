import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseReportConfig } from "@/lib/report-config";
import { requireAgency, requireClientInAgency, toResponse } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgency();
    const { id } = await params;
    const client = await requireClientInAgency(id, ctx.agencyId);
    return NextResponse.json({ config: parseReportConfig(client.reportConfig) });
  } catch (e) {
    return toResponse(e);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgency();
    const { id } = await params;
    await requireClientInAgency(id, ctx.agencyId);

    const body = await request.json();
    const config = parseReportConfig(body.config);

    await prisma.client.update({ where: { id }, data: { reportConfig: config } });
    return NextResponse.json({ config });
  } catch (e) {
    return toResponse(e);
  }
}
