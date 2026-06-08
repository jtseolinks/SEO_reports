export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ClientsTable } from "./clients-table";
import { requireAgencyPage } from "@/lib/authz";

export default async function ClientsPage() {
  const ctx = await requireAgencyPage();
  const clients = await prisma.client.findMany({
    where: { agencyId: ctx.agencyId },
    include: {
      googleProperties: true,
      monthlyReports: {
        orderBy: { reportMonth: "desc" },
        take: 1,
        select: { status: true, reportMonth: true, sentAt: true, generatedAt: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">לקוחות</h1>
          <p className="page-sub">
            {clients.length} לקוחות מנוטרים
            {" · "}
            מחזור דוחות חודשי שלך
          </p>
        </div>
        <div className="page-head-actions">
          <Link href="/admin/clients/import-gsc" className="btn btn-primary accent">
            + ייבא לקוח מהחשבון
          </Link>
        </div>
      </div>

      <ClientsTable
        currentMonth={currentMonth}
        clients={clients.map((c) => {
          const lastReport = c.monthlyReports[0] ?? null;
          // Calculate next report date
          const today = new Date();
          let nextDate: Date | null = null;
          if (c.autoSend) {
            const d = new Date(today.getFullYear(), today.getMonth(), c.reportSendDay);
            if (d <= today) d.setMonth(d.getMonth() + 1);
            nextDate = d;
          }
          return {
            id: c.id,
            name: c.name,
            domain: c.domain,
            contactEmail: c.contactEmail ?? "",
            status: c.status,
            industry: c.industry ?? "",
            reportLanguage: c.reportLanguage,
            autoSend: c.autoSend,
            reportSendDay: c.reportSendDay,
            hasProperties: !!c.googleProperties,
            gscSiteUrl: c.googleProperties?.gscSiteUrl ?? null,
            lastReportStatus: lastReport?.status ?? null,
            lastReportDate: lastReport?.sentAt?.toISOString() ?? lastReport?.generatedAt?.toISOString() ?? null,
            nextReportDate: nextDate?.toISOString() ?? null,
            excludeFromReports: c.excludeFromReports,
          };
        })}
      />
    </div>
  );
}
