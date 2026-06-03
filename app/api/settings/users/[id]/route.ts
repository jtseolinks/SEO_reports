import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Prevent deleting yourself
  const me = await prisma.user.findUnique({ where: { email: session.user?.email ?? "" } });
  if (me?.id === id)
    return NextResponse.json({ error: "לא ניתן למחוק את המשתמש הנוכחי" }, { status: 400 });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { name, email, role } = await req.json() as { name?: string; email?: string; role?: string };

  if (email) {
    const conflict = await prisma.user.findUnique({ where: { email } });
    if (conflict && conflict.id !== id)
      return NextResponse.json({ error: "כתובת האימייל כבר בשימוש" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      name:  name  ?? undefined,
      email: email ?? undefined,
      role:  (role as "ADMIN") ?? undefined,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json({ user });
}
