import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids, action }: { ids: string[]; action: "delete" | "activate" | "deactivate" } =
    await request.json();

  if (!ids?.length) return NextResponse.json({ error: "No ids provided" }, { status: 400 });

  if (action === "delete") {
    await prisma.client.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ affected: ids.length });
  }

  if (action === "activate" || action === "deactivate") {
    const status = action === "activate" ? "ACTIVE" : "INACTIVE";
    await prisma.client.updateMany({ where: { id: { in: ids } }, data: { status } });
    return NextResponse.json({ affected: ids.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
