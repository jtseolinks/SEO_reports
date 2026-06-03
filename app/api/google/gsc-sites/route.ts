import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthenticatedClient } from "@/lib/google-oauth";
import { google } from "googleapis";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await getAuthenticatedClient();
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
