export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { ReportsTable } from "./reports-table";

export default async function ReportsPage() {
  const reports = await prisma.monthlyReport.findMany({
    include: {
      client: { select: { id: true, name: true, domain: true } },
      emailLogs: { select: { id: true, status: true } },
    },
    orderBy: [{ reportMonth: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  // Collect unique months, sorted desc
  const monthsSet = new Set(reports.map(r => r.reportMonth));
  const months = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));

  const serialized = reports.map(r => ({
    id: r.id,
    clientId: r.client.id,
    clientName: r.client.name,
    clientDomain: r.client.domain,
    reportMonth: r.reportMonth,
    status: r.status,
    generatedAt: r.generatedAt?.toISOString() ?? null,
    sentAt: r.sentAt?.toISOString() ?? null,
    pdfUrl: r.pdfUrl,
    errorMessage: r.errorMessage,
    gscClicks: r.gscClicks,
    openCount: r.emailLogs.filter(l => l.status === "sent").length,
  }));

  return <ReportsTable reports={serialized} months={months} />;
}
