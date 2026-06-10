import path from "path";
import fs from "fs/promises";
import { agencyReportsDir, reportPublicUrl } from "./report-storage";

export async function generatePdf(
  html: string,
  agencyId: string,
  filename: string
): Promise<string> {
  const dir = agencyReportsDir(agencyId);
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, path.basename(filename));

  // Single PDF engine: puppeteer-core. On Linux servers (Cloudways) we can't
  // install Chrome's system libraries without root, so use @sparticuz/chromium
  // which bundles them; on local dev machines use the installed Chrome.
  const puppeteer = await import("puppeteer-core");
  let browser;
  if (process.platform === "linux") {
    const chromium = (await import("@sparticuz/chromium")).default;
    browser = await puppeteer.default.launch({
      executablePath: await chromium.executablePath(),
      args: [...chromium.args, "--disable-dev-shm-usage"],
      headless: true,
    });
  } else {
    browser = await puppeteer.default.launch({
      channel: "chrome",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }

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

  // Return the URL path served by the authenticated /reports/[agencyId]/[filename] route
  return reportPublicUrl(agencyId, filename);
}

export function buildReportFilename(clientId: string, reportMonth: string): string {
  const safe = reportMonth.replace(/-/g, "_");
  return `report_${clientId}_${safe}.pdf`;
}
