import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, toResponse } from "@/lib/authz";

export async function GET() {
  try {
    await requireSuperAdmin();

    const agencies = await prisma.agency.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { memberships: true, clients: true, monthlyReports: true },
        },
        googleConnection: { select: { status: true, googleEmail: true } },
        memberships: {
          where: { role: "OWNER" },
          include: { user: { select: { email: true, name: true } } },
          take: 1,
        },
      },
    });

    const data = agencies.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      createdAt: a.createdAt,
      memberCount: a._count.memberships,
      clientCount: a._count.clients,
      reportCount: a._count.monthlyReports,
      googleStatus: a.googleConnection?.status ?? null,
      googleEmail:  a.googleConnection?.googleEmail ?? null,
      owner: a.memberships[0]?.user ?? null,
    }));

    return NextResponse.json({ agencies: data });
  } catch (e) {
    return toResponse(e);
  }
}
