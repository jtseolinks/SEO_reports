import { NextResponse } from "next/server";
import { requireAgency, toResponse } from "@/lib/authz";
import { reportFilePath } from "@/lib/report-storage";
import fs from "fs/promises";

// Shared handler for the report-PDF routes. Streams a generated PDF only to an
// authenticated session, and only for the caller's own agency. The disk path is
// built from the SESSION agency (never the URL), and reportFilePath() strips any
// path traversal in the filename.
export async function serveReport(agencyId: string, filename: string): Promise<NextResponse> {
  let ctx;
  try {
    ctx = await requireAgency();
  } catch (e) {
    return toResponse(e);
  }

  // Cross-agency access → 404 (don't reveal that the file exists elsewhere).
  if (agencyId !== ctx.agencyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!filename.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = reportFilePath(ctx.agencyId, filename);

  let file: Buffer;
  try {
    file = await fs.readFile(filePath);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
