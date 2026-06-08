import { NextResponse } from "next/server";
import { requireAgency, toResponse } from "@/lib/authz";
import { getAuthenticatedClient } from "@/lib/google-oauth";
import { listGa4Properties } from "@/lib/ga4-api";

export async function GET() {
  let ctx;
  try {
    ctx = await requireAgency();
  } catch (e) {
    return toResponse(e);
  }

  const auth = await getAuthenticatedClient(ctx.agencyId);
  if (!auth) {
    return NextResponse.json({ error: "Google account not connected or requires re-auth" }, { status: 400 });
  }

  try {
    const properties = await listGa4Properties(auth);
    return NextResponse.json({ properties });
  } catch (err) {
    console.error("GA4 properties fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch GA4 properties" }, { status: 500 });
  }
}
