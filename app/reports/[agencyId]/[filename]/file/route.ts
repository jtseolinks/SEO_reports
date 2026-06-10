import { NextRequest } from "next/server";
import { serveReport } from "@/lib/serve-report";

type Params = { params: Promise<{ agencyId: string; filename: string }> };

// Canonical report URL: ends in "/file" (no static extension) so Cloudways'
// Apache forwards it to Node instead of serving it statically. See
// reportPublicUrl() in lib/report-storage.ts for the full rationale.
export async function GET(_req: NextRequest, { params }: Params) {
  const { agencyId, filename } = await params;
  return serveReport(agencyId, filename);
}
