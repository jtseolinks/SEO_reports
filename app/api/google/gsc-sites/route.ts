import { NextResponse } from "next/server";
import { requireAgency, toResponse } from "@/lib/authz";
import { getAuthenticatedClient } from "@/lib/google-oauth";
import { google } from "googleapis";

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
    const sc = google.webmasters({ version: "v3", auth });
    const { data } = await sc.sites.list();
    const sites = (data.siteEntry ?? []).map((s) => ({
      siteUrl: s.siteUrl,
      permissionLevel: s.permissionLevel,
    }));
    return NextResponse.json({ sites });
  } catch (err) {
    console.error("GSC sites fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch GSC sites" }, { status: 500 });
  }
}
