import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, toResponse } from "@/lib/authz";

// List all platform users with their agency memberships.
export async function GET() {
  try {
    await requireSuperAdmin();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        createdAt: true,
        memberships: {
          select: { role: true, agency: { select: { name: true } } },
        },
      },
    });
    return NextResponse.json({ users });
  } catch (e) {
    return toResponse(e);
  }
}
