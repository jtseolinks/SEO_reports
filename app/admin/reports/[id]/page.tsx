export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ReportViewPage } from "./report-view-page";

type Params = { params: Promise<{ id: string }> };

export default async function ReportPage({ params }: Params) {
  const { id } = await params;

  const report = await prisma.monthlyReport.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, domain: true, contactEmail: true } },
      emailLogs: { select: { id: true, status: true } },
    },
  });

  if (!report) notFound();

  return (
    <ReportViewPage
      report={{
        id: report.id,
        reportMonth: report.reportMonth,
        status: report.status,
        pdfUrl: report.pdfUrl,
        generatedAt: report.generatedAt?.toISOString() ?? null,
        sentAt: report.sentAt?.toISOString() ?? null,
        errorMessage: report.errorMessage,
        gscClicks: report.gscClicks,
        gscImpressions: report.gscImpressions,
        gscPosition: report.gscPosition,
        gscCtr: report.gscCtr,
        periodStart: report.periodStart?.toISOString() ?? null,
        periodEnd: report.periodEnd?.toISOString() ?? null,
        openCount: report.emailLogs.filter(l => l.status === "sent").length,
        client: {
          id: report.client.id,
          name: report.client.name,
          domain: report.client.domain,
          contactEmail: report.client.contactEmail,
        },
      }}
    />
  );
}
