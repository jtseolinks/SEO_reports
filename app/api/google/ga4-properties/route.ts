import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthenticatedClient } from "@/lib/google-oauth";
import { listGa4Properties } from "@/lib/ga4-api";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await getAuthenticatedClient();
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
