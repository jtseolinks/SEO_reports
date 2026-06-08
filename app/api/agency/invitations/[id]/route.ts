import { NextResponse } from "next/server";
import { requireAgencyAdmin, toResponse } from "@/lib/authz";
import { revokeInvitation } from "@/lib/invitation";

type Props = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Props) {
  try {
    const ctx = await requireAgencyAdmin();
    const { id } = await params;
    await revokeInvitation(id, ctx.agencyId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
