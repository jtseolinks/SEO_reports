import { NextResponse } from "next/server";
import { requireAgencyAdmin, toResponse } from "@/lib/authz";
import { disconnectGoogle } from "@/lib/google-oauth";

export async function POST() {
  try {
    const ctx = await requireAgencyAdmin();
    await disconnectGoogle(ctx.agencyId);
    return NextResponse.json({ success: true });
  } catch (e) {
    return toResponse(e);
  }
}
