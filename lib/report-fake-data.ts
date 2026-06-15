import type { ReportData } from "./report-data";

function mc(current: number, previous: number, lowerIsBetter = false) {
  const change = current - previous;
  const changePct = previous !== 0 ? (change / previous) * 100 : 0;
  return { current, previous, change, changePct, improved: lowerIsBetter ? change < 0 : change > 0 };
}

export function buildFakeReportData(): ReportData {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-based current month
  const periodLabel = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const compLabel = new Date(y, m - 2, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const trendData = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(y, m - 1, i + 1);
    return {
      date: d.toISOString().split("T")[0],
      clicks: 80 + Math.floor(Math.random() * 60),
      impressions: 1200 + Math.floor(Math.random() * 800),
    };
  });

  return {
    client: {
      id: "test",
      name: "Example Client (TEST)",
      domain: "example.com",
    },
    period: {
      startDate: `${y}-${String(m).padStart(2, "0")}-01`,
      endDate: `${y}-${String(m).padStart(2, "0")}-28`,
      label: periodLabel,
    },
    comparisonPeriod: {
      startDate: `${y}-${String(m - 1).padStart(2, "0")}-01`,
      endDate: `${y}-${String(m - 1).padStart(2, "0")}-28`,
      label: compLabel,
    },
    comparisonPeriod2: {
      startDate: `${y}-${String(m - 2).padStart(2, "0")}-01`,
      endDate: `${y}-${String(m - 2).padStart(2, "0")}-28`,
      label: compLabel,
    },
    gsc: {
      clicks: mc(2847, 2310),
      impressions: mc(41200, 38500),
      ctr: mc(0.069, 0.060),
      position: mc(14.2, 16.8, true),
      topQueries: [
        { query: "example seo service", clicks: 320, impressions: 4200, ctr: 0.076, position: 3.1 },
        { query: "best seo agency", clicks: 210, impressions: 5800, ctr: 0.036, position: 7.4 },
        { query: "seo optimization tips", clicks: 185, impressions: 3100, ctr: 0.060, position: 5.2 },
        { query: "local seo services", clicks: 160, impressions: 2900, ctr: 0.055, position: 4.8 },
        { query: "seo consultant", clicks: 140, impressions: 3800, ctr: 0.037, position: 8.1 },
        { query: "technical seo audit", clicks: 122, impressions: 2200, ctr: 0.055, position: 6.3 },
        { query: "seo tools comparison", clicks: 98, impressions: 4100, ctr: 0.024, position: 11.5 },
        { query: "on page seo", clicks: 87, impressions: 1800, ctr: 0.048, position: 9.0 },
      ],
      topPages: [
        { page: "/", clicks: 540, impressions: 7200, ctr: 0.075, position: 4.2 },
        { page: "/services/seo", clicks: 380, impressions: 5100, ctr: 0.074, position: 5.8 },
        { page: "/blog/seo-tips-2024", clicks: 290, impressions: 6400, ctr: 0.045, position: 8.3 },
        { page: "/contact", clicks: 210, impressions: 2800, ctr: 0.075, position: 3.9 },
        { page: "/blog/technical-seo-guide", clicks: 180, impressions: 4200, ctr: 0.043, position: 7.1 },
        { page: "/pricing", clicks: 155, impressions: 2100, ctr: 0.074, position: 4.5 },
      ],
      risingQueries: [
        { query: "seo audit checklist", clicks: 75, impressions: 1900, ctr: 0.039, position: 6.2, prevPosition: 12.1 },
        { query: "ecommerce seo", clicks: 62, impressions: 2100, ctr: 0.030, position: 8.4, prevPosition: 14.7 },
        { query: "seo roi calculator", clicks: 48, impressions: 1400, ctr: 0.034, position: 5.8, prevPosition: 10.9 },
      ],
      decliningQueries: [
        { query: "seo ranking factors", clicks: 42, impressions: 2800, ctr: 0.015, position: 15.3, prevPosition: 9.2 },
        { query: "keyword research tool", clicks: 38, impressions: 3200, ctr: 0.012, position: 18.7, prevPosition: 12.4 },
      ],
      opportunities: [
        { query: "white hat seo techniques", clicks: 18, impressions: 3400, ctr: 0.005, position: 11.2 },
        { query: "seo agency pricing", clicks: 24, impressions: 2900, ctr: 0.008, position: 9.8 },
        { query: "google search console guide", clicks: 31, impressions: 4100, ctr: 0.008, position: 7.6 },
        { query: "seo for small business", clicks: 27, impressions: 2700, ctr: 0.010, position: 12.4 },
      ],
      trendData,
    },
    ga4: {
      sessions: mc(3920, 3410),
      revenue: mc(12450, 9800),
      topLandingPages: [
        { landingPage: "/", sessions: 980, keyEvents: 14 },
        { landingPage: "/services/seo", sessions: 640, keyEvents: 18 },
        { landingPage: "/blog/seo-tips-2024", sessions: 510, keyEvents: 3 },
        { landingPage: "/pricing", sessions: 390, keyEvents: 8 },
        { landingPage: "/contact", sessions: 280, keyEvents: 5 },
      ],
      decliningPages: [
        { landingPage: "/blog/old-seo-guide", sessions: 120, prevSessions: 210 },
        { landingPage: "/blog/keyword-stuffing", sessions: 45, prevSessions: 98 },
      ],
    },
    keywords: [
      { keyword: "rankey", isBrand: true, clicks: 540, impressions: 1200, ctr: 45.0, position: 1.2, prevPosition: 1.3, prev2Position: 1.5, change: 0.1 },
      { keyword: "rankey seo", isBrand: true, clicks: 210, impressions: 480, ctr: 43.8, position: 1.4, prevPosition: 1.6, prev2Position: 1.8, change: 0.2 },
      { keyword: "seo services", isBrand: false, clicks: 320, impressions: 4200, ctr: 7.6, position: 3.1, prevPosition: 4.2, prev2Position: 5.5, change: 1.1 },
      { keyword: "seo agency", isBrand: false, clicks: 210, impressions: 5800, ctr: 3.6, position: 7.4, prevPosition: 8.9, prev2Position: 10.2, change: 1.5 },
      { keyword: "technical seo", isBrand: false, clicks: 122, impressions: 2200, ctr: 5.5, position: 6.3, prevPosition: 5.8, prev2Position: 5.0, change: -0.5 },
      { keyword: "local seo", isBrand: false, clicks: 160, impressions: 2900, ctr: 5.5, position: 4.8, prevPosition: 6.1, prev2Position: 7.0, change: 1.3 },
    ],
    trackedKeywords: [
      { keyword: "rankey", matchType: "EXACT", isBrand: true },
      { keyword: "rankey seo", matchType: "CONTAINS", isBrand: true },
      { keyword: "seo services", matchType: "EXACT", isBrand: false },
      { keyword: "seo agency", matchType: "EXACT", isBrand: false },
      { keyword: "technical seo", matchType: "CONTAINS", isBrand: false },
      { keyword: "local seo", matchType: "CONTAINS", isBrand: false },
    ],
  };
}
