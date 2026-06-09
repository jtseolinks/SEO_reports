import { getAuthenticatedClient, getValidAccessToken } from "./google-oauth";
import { fetchGscSummary, fetchGscDailyTrend, aggregateGsc, type GscRow } from "./gsc-api";
import { fetchGa4OrganicSummary, fetchGa4OrganicLandingPages } from "./ga4-api";
import { prisma } from "./prisma";

export type ReportPeriod = {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  label: string; // e.g. "May 2026"
};

export function getReportPeriods(reportMonth: string): {
  current: ReportPeriod;
  previous: ReportPeriod;
} {
  // reportMonth = "2026-05"
  const [year, month] = reportMonth.split("-").map(Number);
  const currentStart = new Date(year, month - 1, 1);
  const currentEnd = new Date(year, month, 0);

  const prevStart = new Date(year, month - 2, 1);
  const prevEnd = new Date(year, month - 1, 0);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const lbl = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return {
    current: { startDate: fmt(currentStart), endDate: fmt(currentEnd), label: lbl(currentStart) },
    previous: { startDate: fmt(prevStart), endDate: fmt(prevEnd), label: lbl(prevStart) },
  };
}

export type ReportMetricChange = {
  current: number;
  previous: number;
  change: number;
  changePct: number;
  improved: boolean | null; // null = neutral (e.g. position lower = better)
};

function metricChange(current: number, previous: number, lowerIsBetter = false): ReportMetricChange {
  const change = current - previous;
  const changePct = previous !== 0 ? (change / previous) * 100 : 0;
  const improved = lowerIsBetter ? change < 0 : change > 0;
  return { current, previous, change, changePct, improved };
}

export type ReportData = {
  client: {
    id: string;
    name: string;
    domain: string;
  };
  period: ReportPeriod;
  comparisonPeriod: ReportPeriod;
  gsc: {
    clicks: ReportMetricChange;
    impressions: ReportMetricChange;
    ctr: ReportMetricChange;
    position: ReportMetricChange;
    topQueries: GscRow[];
    topPages: GscRow[];
    risingQueries: Array<GscRow & { prevPosition: number }>;
    decliningQueries: Array<GscRow & { prevPosition: number }>;
    opportunities: GscRow[]; // impressions high, position 4-20, CTR low
    trendData: { date: string; clicks: number; impressions: number }[];
  };
  ga4: {
    sessions: ReportMetricChange;
    revenue: ReportMetricChange;
    topLandingPages: Array<{ landingPage?: string; sessions: number; keyEvents: number }>;
    decliningPages: Array<{ landingPage?: string; sessions: number; prevSessions: number }>;
  };
  keywords: Array<{
    keyword: string;
    isBrand: boolean;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    prevPosition: number;
    change: number;
  }>;
  trackedKeywords: Array<{ keyword: string; matchType: string; isBrand: boolean }>;
};

export async function buildReportData(
  agencyId: string,
  clientId: string,
  reportMonth: string,
  customDates?: { startDate: string; endDate: string }
): Promise<ReportData> {
  // Scope by agencyId so a report can only ever be built for a client the
  // agency owns.
  const client = await prisma.client.findFirst({
    where: { id: clientId, agencyId },
    include: { googleProperties: true, keywords: { where: { isActive: true } } },
  });

  if (!client) throw new Error("Client not found");
  if (!client.googleProperties) throw new Error("Client has no Google property mapping");

  const { gscSiteUrl, ga4PropertyId } = client.googleProperties;
  const { current: defaultCurrent, previous } = getReportPeriods(reportMonth);
  const current = customDates
    ? { ...customDates, label: `${customDates.startDate} – ${customDates.endDate}` }
    : defaultCurrent;

  // Force-refresh the token so the cron job works even after a prior transient error.
  await getValidAccessToken(agencyId, { force: true });
  const auth = await getAuthenticatedClient(agencyId);
  if (!auth) throw new Error("Google account not connected or token permanently revoked");

  const hasGa4 = !!ga4PropertyId;

  const [
    currentGscQueries,
    previousGscQueries,
    currentGscPages,
    previousGscPages,
    trendRaw,
  ] = await Promise.all([
    fetchGscSummary(auth, gscSiteUrl, current.startDate, current.endDate, ["query"]),
    fetchGscSummary(auth, gscSiteUrl, previous.startDate, previous.endDate, ["query"]),
    fetchGscSummary(auth, gscSiteUrl, current.startDate, current.endDate, ["page"]),
    fetchGscSummary(auth, gscSiteUrl, previous.startDate, previous.endDate, ["page"]),
    fetchGscDailyTrend(auth, gscSiteUrl, current.startDate, current.endDate),
  ]);

  const emptyGa4 = { sessions: 0, revenue: 0 };
  const [currentGa4, previousGa4, currentGa4Pages, previousGa4Pages] = hasGa4
    ? await Promise.all([
        fetchGa4OrganicSummary(auth, ga4PropertyId, current.startDate, current.endDate),
        fetchGa4OrganicSummary(auth, ga4PropertyId, previous.startDate, previous.endDate),
        fetchGa4OrganicLandingPages(auth, ga4PropertyId, current.startDate, current.endDate, 20),
        fetchGa4OrganicLandingPages(auth, ga4PropertyId, previous.startDate, previous.endDate, 20),
      ])
    : [emptyGa4, emptyGa4, [], []];

  // Aggregate GSC totals
  const aggCurrent = aggregateGsc(currentGscQueries);
  const aggPrevious = aggregateGsc(previousGscQueries);
  const totalImp = aggCurrent.impressions || 1;
  const totalImpPrev = aggPrevious.impressions || 1;

  // Non-brand filter — excludes any query that contains a brand keyword
  const brandTerms = client.keywords
    .filter((k) => k.isBrand)
    .map((k) => k.keyword.toLowerCase());

  // Regex-based: each brand term is treated as a regex pattern (case-insensitive).
  // Falls back to simple contains-match if the term is an invalid regex.
  function isNonBrand(query: string | undefined | null): boolean {
    if (!query) return true;
    return !brandTerms.some((bk) => {
      try {
        return new RegExp(bk, "i").test(query);
      } catch {
        return query.toLowerCase().includes(bk);
      }
    });
  }

  const nonBrandQueries = currentGscQueries.filter((r) => isNonBrand(r.query));
  const nonBrandPrevQueries = previousGscQueries.filter((r) => isNonBrand(r.query));

  // Build query lookup maps
  const prevQueryMap = new Map(nonBrandPrevQueries.map((r) => [r.query, r]));
  const prevPageMap = new Map(previousGscPages.map((r) => [r.page, r]));

  // Rising and declining queries (position changed significantly)
  const risingQueries = nonBrandQueries
    .filter((r) => {
      const prev = prevQueryMap.get(r.query ?? "");
      return prev && prev.position - r.position >= 3 && r.impressions >= 50;
    })
    .map((r) => ({ ...r, prevPosition: prevQueryMap.get(r.query ?? "")!.position }))
    .sort((a, b) => (b.prevPosition - b.position) - (a.prevPosition - a.position))
    .slice(0, 10);

  const decliningQueries = nonBrandQueries
    .filter((r) => {
      const prev = prevQueryMap.get(r.query ?? "");
      return prev && r.position - prev.position >= 3 && prev.impressions >= 50;
    })
    .map((r) => ({ ...r, prevPosition: prevQueryMap.get(r.query ?? "")!.position }))
    .sort((a, b) => (b.position - b.prevPosition) - (a.position - a.prevPosition))
    .slice(0, 10);

  // SEO opportunities: high impressions, position 4-20, low CTR
  const avgCtr = totalImp > 0 ? aggCurrent.totalCtrWeight / totalImp : 0.03;
  const opportunities = nonBrandQueries
    .filter((r) => r.impressions >= 100 && r.position >= 4 && r.position <= 20 && r.ctr < avgCtr)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  // Tracked keyword performance — the keywords explicitly chosen for the report.
  const chosenKeywords = client.keywords.map((kw) => {
    const matchFn = kw.matchType === "EXACT"
      ? (q: string) => q === kw.keyword
      : (q: string) => q.includes(kw.keyword);

    const matched = currentGscQueries.filter((r) => r.query && matchFn(r.query.toLowerCase()));
    const matchedPrev = previousGscQueries.filter((r) => r.query && matchFn(r.query?.toLowerCase() ?? ""));

    const clicks = matched.reduce((s, r) => s + r.clicks, 0);
    const impressions = matched.reduce((s, r) => s + r.impressions, 0);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const position = matched.length > 0
      ? matched.reduce((s, r) => s + r.position * r.impressions, 0) / (impressions || 1)
      : 0;
    const prevImp = matchedPrev.reduce((s, r) => s + r.impressions, 0);
    const prevPosition = matchedPrev.length > 0
      ? matchedPrev.reduce((s, r) => s + r.position * r.impressions, 0) / (prevImp || 1)
      : 0;

    return {
      keyword: kw.keyword,
      isBrand: kw.isBrand,
      clicks,
      impressions,
      ctr,
      position,
      prevPosition,
      change: prevPosition > 0 ? prevPosition - position : 0,
    };
  });

  // Default behaviour: if NO non-brand keyword was chosen for the report
  // (neither by marking a GSC query nor by adding one manually), fall back to
  // the full general keyword list shown on the client page — every non-brand
  // GSC query for the period (same 100-row cap as the page), sorted by clicks.
  const hasChosenKeywords = chosenKeywords.some((k) => !k.isBrand);
  const keywords = hasChosenKeywords
    ? chosenKeywords
    : [...nonBrandQueries]
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 100)
        .map((r) => {
          const prevPosition = prevQueryMap.get(r.query ?? "")?.position ?? 0;
          return {
            keyword: r.query ?? "",
            isBrand: false,
            clicks: r.clicks,
            impressions: r.impressions,
            ctr: r.ctr * 100,
            position: r.position,
            prevPosition,
            change: prevPosition > 0 ? prevPosition - r.position : 0,
          };
        });

  // GA4 declining pages
  const prevPageMapGa4 = new Map(previousGa4Pages.map((r) => [r.landingPage, r]));
  const decliningPages = currentGa4Pages
    .filter((r) => {
      const prev = prevPageMapGa4.get(r.landingPage);
      return prev && prev.sessions > 0 && (r.sessions - prev.sessions) / prev.sessions < -0.15;
    })
    .map((r) => ({
      landingPage: r.landingPage,
      sessions: r.sessions,
      prevSessions: prevPageMapGa4.get(r.landingPage)!.sessions,
    }))
    .slice(0, 10);

  return {
    client: { id: client.id, name: client.name, domain: client.domain },
    period: current,
    comparisonPeriod: previous,
    gsc: {
      clicks: metricChange(aggCurrent.clicks, aggPrevious.clicks),
      impressions: metricChange(aggCurrent.impressions, aggPrevious.impressions),
      ctr: metricChange(
        aggCurrent.totalCtrWeight / totalImp,
        aggPrevious.totalCtrWeight / totalImpPrev
      ),
      position: metricChange(
        aggCurrent.totalPosWeight / totalImp,
        aggPrevious.totalPosWeight / totalImpPrev,
        true
      ),
      topQueries: nonBrandQueries.slice(0, 20),
      topPages: currentGscPages.slice(0, 20),
      risingQueries,
      decliningQueries,
      opportunities,
      trendData: trendRaw.map((r) => ({ date: r.date, clicks: r.clicks, impressions: r.impressions })),
    },
    ga4: {
      sessions: metricChange(currentGa4.sessions, previousGa4.sessions),
      revenue: metricChange(currentGa4.revenue, previousGa4.revenue),
      topLandingPages: currentGa4Pages.slice(0, 15),
      decliningPages,
    },
    keywords,
    trackedKeywords: client.keywords.map((kw) => ({
      keyword: kw.keyword,
      matchType: kw.matchType,
      isBrand: kw.isBrand,
    })),
  };
}
