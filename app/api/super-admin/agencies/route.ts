import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, toResponse } from "@/lib/authz";
import bcrypt from "bcryptjs";

async function uniqueSlug(base: string): Promise<string> {
  const slug =
    base
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 48) || "agency";

  const existing = await prisma.agency.findMany({
    where: { slug: { startsWith: slug } },
    select: { slug: true },
  });
  if (!existing.find((a) => a.slug === slug)) return slug;
  for (let i = 2; i <= 99; i++) {
    const c = `${slug}-${i}`;
    if (!existing.find((a) => a.slug === c)) return c;
  }
  return `${slug}-${Date.now()}`;
}

// List all agencies with stats.
export async function GET() {
  try {
    await requireSuperAdmin();
    const agencies = await prisma.agency.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { memberships: true, clients: true, monthlyReports: true } },
        googleConnection: { select: { status: true, googleEmail: true } },
        memberships: {
          where: { role: "OWNER" },
          include: { user: { select: { email: true, name: true } } },
          take: 1,
        },
      },
    });
    return NextResponse.json({
      agencies: agencies.map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        createdAt: a.createdAt,
        memberCount: a._count.memberships,
        clientCount: a._count.clients,
        reportCount: a._count.monthlyReports,
        googleStatus: a.googleConnection?.status ?? null,
        googleEmail: a.googleConnection?.googleEmail ?? null,
        owner: a.memberships[0]?.user ?? null,
      })),
    });
  } catch (e) {
    return toResponse(e);
  }
}

// Create a new agency, optionally with an initial owner.
export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin();
    const { agencyName, ownerEmail, ownerName, ownerPassword } = (await req.json()) as {
      agencyName: string;
      ownerEmail?: string;
      ownerName?: string;
      ownerPassword?: string;
    };

    if (!agencyName?.trim())
      return NextResponse.json({ error: "שם הסוכנות נדרש" }, { status: 400 });

    const slug = await uniqueSlug(agencyName.trim());

    const agency = await prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({ data: { name: agencyName.trim(), slug } });

      if (ownerEmail) {
        let owner = await tx.user.findUnique({ where: { email: ownerEmail } });
        if (!owner) {
          if (!ownerPassword || ownerPassword.length < 8) {
            throw new Error("New owner requires password (min 8 chars)");
          }
          owner = await tx.user.create({
            data: {
              email: ownerEmail,
              name: ownerName?.trim() || null,
              passwordHash: await bcrypt.hash(ownerPassword, 12),
            },
          });
        }
        await tx.membership.create({ data: { userId: owner.id, agencyId: agency.id, role: "OWNER" } });
      }

      return agency;
    });

    return NextResponse.json({ agencyId: agency.id, name: agency.name, slug: agency.slug }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message.includes("password")) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return toResponse(e);
  }
}
