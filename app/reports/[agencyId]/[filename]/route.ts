import { NextRequest } from "next/server";
import { serveReport } from "@/lib/serve-report";

type Params = { params: Promise<{ agencyId: string; filename: string }> };

// Legacy report URL (ends in ".pdf"). Kept so pre-existing pdfUrl rows still
// resolve when accessed directly via Node. New URLs use the "/file" variant -
// on Cloudways a ".pdf"-terminated URL is intercepted by Apache and never
// reaches this route. See reportPublicUrl() in lib/report-storage.ts.
export async function GET(_req: NextRequest, { params }: Params) {
  const { agencyId, filename } = await params;
  return serveReport(agencyId, filename);
}
