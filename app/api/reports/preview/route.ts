import { NextRequest, NextResponse } from "next/server";
import { requireAgency, toResponse } from "@/lib/authz";
import { buildFakeReportData } from "@/lib/report-fake-data";
import { generateReportHtml } from "@/lib/report-template";
import { generatePdf, buildReportFilename } from "@/lib/pdf-generator";
import { sendReportEmail } from "@/lib/email";
import { getAgencySettings } from "@/lib/agency-settings";

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAgency();
  } catch (e) {
    return toResponse(e);
  }

  const { sendEmail } = await request.json().catch(() => ({ sendEmail: false }));

  const settings = await getAgencySettings(ctx.agencyId);
  const agencyName = settings.agencyName || process.env.AGENCY_NAME || "SEO Agency";
  const agencyEmail = settings.contactEmail || process.env.AGENCY_EMAIL || "";

  const data = buildFakeReportData();
  const html = generateReportHtml(data, agencyName, agencyEmail);
  const filename = buildReportFilename("test", `test-${Date.now()}`);
  const pdfUrl = await generatePdf(html, ctx.agencyId, filename);

  if (sendEmail) {
    const to = ctx.email;
    if (!to) return NextResponse.json({ error: "No admin email found" }, { status: 400 });

    await sendReportEmail({
      agencyId: ctx.agencyId,
      to,
      cc: [],
      clientName: "Example Client (TEST)",
      monthName: data.period.label,
      pdfUrl,
    });

    return NextResponse.json({ pdfUrl, sentTo: to });
  }

  return NextResponse.json({ pdfUrl });
}
