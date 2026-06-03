import path from "path";
import fs from "fs/promises";

const REPORTS_DIR = path.join(process.cwd(), "public", "reports");

async function ensureReportsDir() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

export async function generatePdf(
  html: string,
  filename: string
): Promise<string> {
  await ensureReportsDir();

  const filePath = path.join(REPORTS_DIR, filename);

  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.pdf({
      path: filePath,
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
  } finally {
    await browser.close();
  }

  // Return public URL path (relative to /public)
  return `/reports/${filename}`;
}

export function buildReportFilename(clientId: string, reportMonth: string): string {
  const safe = reportMonth.replace(/-/g, "_");
  return `report_${clientId}_${safe}.pdf`;
}
