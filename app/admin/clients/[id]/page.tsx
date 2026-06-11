export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ClientDetailPage } from "./client-detail-page";
import { requireAgencyPage } from "@/lib/authz";

type Props = { params: Promise<{ id: string }> };

export default async function ClientDetailRoute({ params }: Props) {
  const { id } = await params;
  const ctx = await requireAgencyPage();

  const client = await prisma.client.findFirst({
    where: { id, agencyId: ctx.agencyId },
    include: {
      googleProperties: true,
      keywords: { where: { isActive: true }, orderBy: { keyword: "asc" } },
      monthlyReports: {
        orderBy: { reportMonth: "desc" },
        take: 12,
        include: {
          emailLogs: { select: { id: true, status: true } },
        },
      },
    },
  });

  if (!client) notFound();

  return (
    <ClientDetailPage
      client={{
        id: client.id,
        name: client.name,
        domain: client.domain,
        contactEmail: client.contactEmail,
        ccEmails: client.ccEmails,
        reportSendDay: client.reportSendDay,
        reportSendHour: client.reportSendHour,
        status: client.status,
        notes: client.notes,
        industry: client.industry ?? "",
        reportLanguage: client.reportLanguage,
        autoSend: client.autoSend,
        createdAt: client.createdAt.toISOString(),
        brandNameHe: client.brandNameHe ?? "",
        brandNameEn: client.brandNameEn ?? "",
        excludeFromReports: client.excludeFromReports,
        sendDayCustom: client.sendDayCustom,
      }}
      properties={client.googleProperties ? {
        gscSiteUrl:      client.googleProperties.gscSiteUrl,
        ga4PropertyId:   client.googleProperties.ga4PropertyId,
        ga4PropertyName: client.googleProperties.ga4PropertyName,
      } : null}
      brandKeywords={client.keywords.filter(k => k.isBrand).map(k => k.keyword)}
      reports={client.monthlyReports.map(r => ({
        id: r.id,
        reportMonth: r.reportMonth,
        status: r.status,
        generatedAt: r.generatedAt?.toISOString() ?? null,
        sentAt: r.sentAt?.toISOString() ?? null,
        pdfUrl: r.pdfUrl,
        errorMessage: r.errorMessage,
        gscClicks: r.gscClicks,
        gscImpressions: r.gscImpressions,
        gscPosition: r.gscPosition,
        gscCtr: r.gscCtr,
        recipientCount: r.emailLogs.length,
      }))}
    />
  );
}
