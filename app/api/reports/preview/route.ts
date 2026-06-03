import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildFakeReportData } from "@/lib/report-fake-data";
import { generateReportHtml } from "@/lib/report-template";
import { generatePdf, buildReportFilename } from "@/lib/pdf-generator";
import { sendReportEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sendEmail } = await request.json().catch(() => ({ sendEmail: false }));

  const agencyName = process.env.AGENCY_NAME ?? "SEO Agency";
  const agencyEmail = process.env.AGENCY_EMAIL ?? "";

  const data = buildFakeReportData();
  const html = generateReportHtml(data, agencyName, agencyEmail);
  const filename = buildReportFilename("test", `test-${Date.now()}`);
  const pdfUrl = await generatePdf(html, filename);

  if (sendEmail) {
    const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    const to = adminUser?.email ?? session.user?.email ?? "";
    if (!to) return NextResponse.json({ error: "No admin email found" }, { status: 400 });

    await sendReportEmail({
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
