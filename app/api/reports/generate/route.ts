import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgency, requireClientInAgency, toResponse, HttpError } from "@/lib/authz";
import { buildReportData, getReportPeriods } from "@/lib/report-data";
import { generateReportHtml } from "@/lib/report-template";
import { getAgencySettings } from "@/lib/agency-settings";
import { parseReportConfig } from "@/lib/report-config";
import { generatePdf, buildReportFilename } from "@/lib/pdf-generator";
import fs from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAgency();
  } catch (e) {
    return toResponse(e);
  }

  const { clientId, reportMonth, startDate, endDate } = await request.json();
  if (!clientId || !reportMonth) {
    return NextResponse.json({ error: "clientId and reportMonth are required" }, { status: 400 });
  }

  // Validate month format YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(reportMonth)) {
    return NextResponse.json({ error: "reportMonth must be YYYY-MM" }, { status: 400 });
  }

  // Verify the client belongs to this agency before creating any report rows.
  try {
    await requireClientInAgency(clientId, ctx.agencyId);
  } catch (e) {
    return toResponse(e);
  }

  const customDates = startDate && endDate ? { startDate, endDate } : undefined;
  const { current: defaultCurrent, previous } = getReportPeriods(reportMonth);
  const current = customDates
    ? { ...customDates, label: `${startDate} – ${endDate}` }
    : defaultCurrent;

  const report = await prisma.monthlyReport.upsert({
    where: { clientId_reportMonth: { clientId, reportMonth } },
    create: {
      agencyId: ctx.agencyId,
      clientId,
      reportMonth,
      periodStart: new Date(current.startDate),
      periodEnd: new Date(current.endDate),
      comparisonStart: new Date(previous.startDate),
      comparisonEnd: new Date(previous.endDate),
      status: "DRAFT",
    },
    update: {
      status: "DRAFT",
      errorMessage: null,
      pdfUrl: null,
      periodStart: new Date(current.startDate),
      periodEnd: new Date(current.endDate),
    },
  });

  try {
    const [data, agencySettings, clientRow] = await Promise.all([
      buildReportData(ctx.agencyId, clientId, reportMonth, customDates),
      getAgencySettings(ctx.agencyId),
      prisma.client.findUnique({ where: { id: clientId }, select: { reportConfig: true } }),
    ]);
    const reportCfg = parseReportConfig(clientRow?.reportConfig);
    const agencyName  = agencySettings.agencyName  || process.env.AGENCY_NAME  || "SEO Agency";
    const agencyEmail = agencySettings.contactEmail || process.env.AGENCY_EMAIL || "";

    // Convert logo to base64 so Puppeteer can render it without HTTP requests
    let logoDataUrl = "";
    if (agencySettings.logoUrl) {
      try {
        const logoPath = path.join(process.cwd(), "public", agencySettings.logoUrl.replace(/^\//, ""));
        const logoBuffer = await fs.readFile(logoPath);
        const ext = path.extname(agencySettings.logoUrl).toLowerCase().replace(".", "");
        const mime = ext === "svg" ? "image/svg+xml" : ext === "png" ? "image/png" : "image/jpeg";
        logoDataUrl = `data:${mime};base64,${logoBuffer.toString("base64")}`;
      } catch {
        // logo file not found — skip silently
      }
    }

    const html = generateReportHtml(data, agencyName, agencyEmail, logoDataUrl, reportCfg);

    const filename = buildReportFilename(clientId, reportMonth);
    const pdfUrl = await generatePdf(html, ctx.agencyId, filename);

    await prisma.monthlyReport.update({
      where: { id: report.id },
      data: {
        status: "GENERATED",
        pdfUrl,
        generatedAt: new Date(),
        gscClicks: data.gsc.clicks.current,
        gscImpressions: data.gsc.impressions.current,
        gscPosition: data.gsc.position.current,
        gscCtr: data.gsc.ctr.current,
      },
    });

    return NextResponse.json({ success: true, reportId: report.id, pdfUrl });
  } catch (err) {
    if (err instanceof HttpError) return toResponse(err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Report generation error:", err);

    await prisma.monthlyReport.update({
      where: { id: report.id },
      data: { status: "FAILED", errorMessage },
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
