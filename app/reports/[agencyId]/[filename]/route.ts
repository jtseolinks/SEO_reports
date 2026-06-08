import { NextRequest, NextResponse } from "next/server";
import { requireAgency, toResponse } from "@/lib/authz";
import { reportFilePath } from "@/lib/report-storage";
import fs from "fs/promises";

type Params = { params: Promise<{ agencyId: string; filename: string }> };

// Streams generated PDF reports only to authenticated sessions, and only for
// the caller's own agency. Files are namespaced per agency on disk.
export async function GET(_req: NextRequest, { params }: Params) {
  let ctx;
  try {
    ctx = await requireAgency();
  } catch (e) {
    return toResponse(e);
  }

  const { agencyId, filename } = await params;

  // Cross-agency access → 404 (don't reveal that the file exists elsewhere).
  if (agencyId !== ctx.agencyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!filename.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Build the disk path from the SESSION agency, never the URL — and
  // reportFilePath() strips any path traversal in the filename.
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
