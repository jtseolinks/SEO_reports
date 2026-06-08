import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, toResponse } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

// Toggle isSuperAdmin or update name.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireSuperAdmin();
    const { id } = await params;

    // Prevent revoking own super-admin.
    if (id === ctx.userId) {
      const body = (await req.json()) as { isSuperAdmin?: boolean };
      if (body.isSuperAdmin === false) {
        return NextResponse.json({ error: "לא ניתן להסיר הרשאת super-admin מעצמך" }, { status: 400 });
      }
    }

    const { isSuperAdmin, name } = (await req.json().catch(() => ({}))) as {
      isSuperAdmin?: boolean;
      name?: string;
    };

    const user = await prisma.user.update({
      where: { id },
      data: {
        isSuperAdmin: isSuperAdmin !== undefined ? isSuperAdmin : undefined,
        name: name !== undefined ? name?.trim() || null : undefined,
      },
      select: { id: true, email: true, name: true, isSuperAdmin: true },
    });
    return NextResponse.json({ user });
  } catch (e) {
    return toResponse(e);
  }
}
