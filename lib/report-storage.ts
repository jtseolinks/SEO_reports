import path from "path";
import fs from "fs/promises";

// Generated PDF reports are stored OUTSIDE the public directory so they are
// never served as unauthenticated static files. They are streamed only through
// the authenticated route at /reports/[agencyId]/[filename]. Files are
// namespaced per agency so one tenant can never reference another's PDFs.
export const REPORTS_DIR = path.join(process.cwd(), "private", "reports");

// Public URL path used in the DB (pdfUrl) and the admin UI. Handled by the
// authenticated route handler, not by static file serving.
//
// The trailing "/file" segment is load-bearing on Cloudways: the platform's
// Apache serves any URL ending in a static extension (.pdf, .jpg, ...) directly
// from public_html, bypassing the Node reverse proxy. A URL ending in ".pdf"
// therefore never reaches this app's route. Ending the path in "/file" (no
// extension) keeps the request on the Node side. The route segment for the PDF
// name still carries ".pdf"; only the URL's final segment must be extensionless.
export function reportPublicUrl(agencyId: string, filename: string): string {
  return `/reports/${agencyId}/${filename}/file`;
}

// Resolve an (agencyId, filename) pair to an absolute path on disk.
// basename() on both segments prevents path traversal.
export function reportFilePath(agencyId: string, filename: string): string {
  return path.join(REPORTS_DIR, path.basename(agencyId), path.basename(filename));
}

// Resolve a stored pdfUrl to an absolute path. Handles both URL shapes:
//   legacy:    /reports/<agencyId>/<file>.pdf
//   canonical: /reports/<agencyId>/<file>.pdf/file   (trailing "/file" for Cloudways)
export function reportFilePathFromUrl(pdfUrl: string): string {
  let parts = pdfUrl.split("/").filter(Boolean);
  // Drop the trailing "/file" segment so the real filename is the last part.
  if (parts[parts.length - 1] === "file") parts = parts.slice(0, -1);
  const filename = parts[parts.length - 1] ?? "";
  const agencyId = parts.length >= 3 ? parts[parts.length - 2] : "";
  return reportFilePath(agencyId, filename);
}

// Directory holding one agency's report PDFs.
export function agencyReportsDir(agencyId: string): string {
  return path.join(REPORTS_DIR, path.basename(agencyId));
}

// Delete a generated PDF from disk (by its stored pdfUrl). Used after a report
// is delivered. Missing files are ignored.
export async function deleteReportFile(pdfUrl: string): Promise<void> {
  try {
    await fs.unlink(reportFilePathFromUrl(pdfUrl));
  } catch {
    // File already gone or never existed — nothing to do.
  }
}
