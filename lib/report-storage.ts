import path from "path";
import fs from "fs/promises";

// Generated PDF reports are stored OUTSIDE the public directory so they are
// never served as unauthenticated static files. They are streamed only through
// the authenticated route at /reports/[filename].
export const REPORTS_DIR = path.join(process.cwd(), "private", "reports");

// Public URL path used in the DB (pdfUrl) and the admin UI. It is handled by
// the authenticated route handler, not by static file serving.
export function reportPublicUrl(filename: string): string {
  return `/reports/${filename}`;
}

// Resolve a stored pdfUrl (or filename) to an absolute path on disk.
// Uses basename() to strip any directory component → prevents path traversal.
export function reportFilePath(pdfUrlOrName: string): string {
  const filename = path.basename(pdfUrlOrName);
  return path.join(REPORTS_DIR, filename);
}

// Delete a generated PDF from disk. Used after a report is delivered to the
// client — the file is no longer needed and only the status record is kept.
// Missing files are ignored.
export async function deleteReportFile(pdfUrlOrName: string): Promise<void> {
  try {
    await fs.unlink(reportFilePath(pdfUrlOrName));
  } catch {
    // File already gone or never existed — nothing to do.
  }
}
