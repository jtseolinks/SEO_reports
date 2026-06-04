export type ReportConfig = {
  kpi_clicks:      boolean;
  kpi_impressions: boolean;
  kpi_ctr:         boolean;
  kpi_position:    boolean;
  exec_summary:    boolean;
  trend_chart:     boolean;
  ga4_sessions:    boolean;
  ga4_revenue:     boolean;
  keywords_table:  boolean;
  pages_table:     boolean;
  ga4_pages:       boolean;
};

export const DEFAULT_REPORT_CONFIG: ReportConfig = {
  kpi_clicks:      true,
  kpi_impressions: true,
  kpi_ctr:         true,
  kpi_position:    true,
  exec_summary:    true,
  trend_chart:     false,
  ga4_sessions:    true,
  ga4_revenue:     true,
  keywords_table:  true,
  pages_table:     true,
  ga4_pages:       true,
};

export const REPORT_SECTIONS = [
  {
    group: "תקציר ביצועים (01)",
    items: [
      { id: "kpi_clicks"      as keyof ReportConfig, label: "קליקים אורגניים" },
      { id: "kpi_impressions" as keyof ReportConfig, label: "חשיפות" },
      { id: "kpi_ctr"         as keyof ReportConfig, label: "CTR ממוצע" },
      { id: "kpi_position"    as keyof ReportConfig, label: "פוזיציה ממוצעת" },
      { id: "exec_summary"    as keyof ReportConfig, label: "תקציר מנהלים" },
    ],
  },
  {
    group: "תנועה אורגנית (02)",
    items: [
      { id: "trend_chart"  as keyof ReportConfig, label: "גרף מגמה יומי" },
      { id: "ga4_sessions" as keyof ReportConfig, label: "סשנים אורגניים (GA4)" },
      { id: "ga4_revenue"  as keyof ReportConfig, label: "הכנסות (GA4)" },
    ],
  },
  {
    group: "ביטויי מפתח (03)",
    items: [
      { id: "keywords_table" as keyof ReportConfig, label: "טבלת ביטויי מפתח" },
    ],
  },
  {
    group: "דפים מובילים (04)",
    items: [
      { id: "pages_table" as keyof ReportConfig, label: "טבלת דפים מובילים" },
    ],
  },
  {
    group: "Analytics דפי נחיתה (05)",
    items: [
      { id: "ga4_pages" as keyof ReportConfig, label: "דפי נחיתה אורגניים" },
    ],
  },
] as const;

export function parseReportConfig(raw: unknown): ReportConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_REPORT_CONFIG };
  return { ...DEFAULT_REPORT_CONFIG, ...(raw as Partial<ReportConfig>) };
}
