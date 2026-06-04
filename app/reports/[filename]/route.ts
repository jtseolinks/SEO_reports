import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { reportFilePath } from "@/lib/report-storage";
import fs from "fs/promises";

type Params = { params: Promise<{ filename: string }> };

// Streams generated PDF reports only to authenticated sessions.
// Previously these were static files under /public/reports and downloadable
// by anyone who knew the URL.
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename } = await params;

  // Only ever serve .pdf files; reportFilePath() strips any path traversal.
  if (!filename.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = reportFilePath(filename);

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
