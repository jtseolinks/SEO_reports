import type { ReportData, ReportMetricChange } from "./report-data";
import { type ReportConfig, DEFAULT_REPORT_CONFIG } from "./report-config";

// ── HTML escaping ───────────────────────────────────────────────────────────────
// All dynamic strings (keywords, page URLs, client/agency names) are escaped
// before interpolation so they cannot inject markup into the rendered HTML/PDF.
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── formatters ────────────────────────────────────────────────────────────────

function fmtBig(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString("he-IL");
}

function fmtNum(n: number, dec = 0): string {
  return n.toFixed(dec);
}

function fmtPct(n: number, dec = 2): string {
  return n.toFixed(dec) + "%";
}

function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("he-IL", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function fmtPeriod(start: string, end: string): string {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  return `${s.getDate().toString().padStart(2, "0")} ${s.toLocaleDateString("he-IL", { month: "long" })} – ${e.getDate().toString().padStart(2, "0")} ${e.toLocaleDateString("he-IL", { month: "long", year: "numeric" })}`;
}

// ── change badge ──────────────────────────────────────────────────────────────

function changeBadge(m: ReportMetricChange, lowerIsBetter = false): string {
  if (Math.abs(m.changePct) < 0.01 && Math.abs(m.change) < 0.01) {
    return `<span style="font-size:11px;color:#9ca3af;font-weight:500">ללא שינוי</span>`;
  }
  const isPositive = lowerIsBetter ? m.change < 0 : m.change > 0;
  const color = isPositive ? "#16a34a" : "#dc2626";
  const bg = isPositive ? "#f0fdf4" : "#fef2f2";
  const border = isPositive ? "#bbf7d0" : "#fecaca";
  const arrow = m.change > 0 ? "↑" : "↓";
  const sign = m.changePct > 0 ? "+" : "";
  return `<span style="display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:600;color:${color};background:${bg};border:1px solid ${border};padding:2px 7px;border-radius:20px;line-height:1.4">${arrow} ${sign}${fmtPct(Math.abs(m.changePct), 1)}</span>`;
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function kpiCard(label: string, value: string, sub: string, m: ReportMetricChange, lowerIsBetter = false, prevValue = ""): string {
  return `
  <div style="flex:1;display:flex;flex-direction:column;background:#F8F9FB;border:1.5px solid #E8EAEE;border-radius:12px;padding:18px 20px;">
    <div style="font-size:11px;color:#6b7280;font-weight:500;margin-bottom:4px">${label}</div>
    <div style="font-size:28px;font-weight:800;color:#111827;letter-spacing:-0.03em;line-height:1.1">${value}</div>
    ${sub ? `<div style="font-size:11px;color:#9ca3af;margin-top:2px">${sub}</div>` : ""}
    ${prevValue ? `<div style="font-size:11px;color:#9ca3af;margin-top:8px;padding-top:8px;border-top:1px solid #EEF0F3">תקופה קודמת: <span style="font-weight:700;color:#6b7280">${prevValue}</span></div>` : ""}
    <div style="margin-top:auto;padding-top:10px">${changeBadge(m, lowerIsBetter)}</div>
  </div>`;
}

// ── SVG trend chart ───────────────────────────────────────────────────────────

// Dual-line clicks + impressions chart - mirrors the live GSC panel on the admin
// client dashboard (DualLineChart). Clicks (blue, left axis) over impressions
// (purple, right axis), with a legend showing the period totals.
function trendChart(
  trendData: { date: string; clicks: number; impressions: number }[],
  totals?: { clicks: number; impressions: number },
): string {
  if (!trendData || trendData.length < 2) {
    return `<div style="height:200px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px">אין נתוני מגמה זמינים</div>`;
  }

  const W = 700, H = 220;
  const pt = 14, pb = 30, pl = 44, pr = 44;
  const chartW = W - pl - pr;
  const chartH = H - pt - pb;
  const n = trendData.length;

  const maxC = Math.max(...trendData.map(d => d.clicks), 1);
  const maxI = Math.max(...trendData.map(d => d.impressions), 1);

  const x = (i: number) => pl + (i / Math.max(n - 1, 1)) * chartW;
  const yC = (v: number) => pt + (1 - v / maxC) * chartH;
  const yI = (v: number) => pt + (1 - v / maxI) * chartH;

  const cPts = trendData.map((d, i) => `${x(i).toFixed(1)},${yC(d.clicks).toFixed(1)}`).join(" ");
  const iPts = trendData.map((d, i) => `${x(i).toFixed(1)},${yI(d.impressions).toFixed(1)}`).join(" ");
  const cArea = `${x(0).toFixed(1)},${(H - pb).toFixed(1)} ${cPts} ${x(n - 1).toFixed(1)},${(H - pb).toFixed(1)}`;
  const iArea = `${x(0).toFixed(1)},${(H - pb).toFixed(1)} ${iPts} ${x(n - 1).toFixed(1)},${(H - pb).toFixed(1)}`;

  const step = Math.max(1, Math.ceil(n / 7));
  const fmtK = (v: number) => v >= 1000 ? (v / 1000).toFixed(1).replace(/\.0$/, "") + "K" : String(v);

  // Y gridlines + dual axis labels (clicks left, impressions right)
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => {
    const yv = pt + (1 - pct) * chartH;
    return `
      <line x1="${pl}" y1="${yv.toFixed(1)}" x2="${W - pr}" y2="${yv.toFixed(1)}" stroke="#f1f5f9" stroke-width="1"/>
      <text x="${(pl - 5).toFixed(1)}" y="${(yv + 3.5).toFixed(1)}" text-anchor="end" font-size="8" fill="#93c5fd" font-family="Heebo,Arial,sans-serif">${fmtK(Math.round(maxC * pct))}</text>
      <text x="${(W - pr + 5).toFixed(1)}" y="${(yv + 3.5).toFixed(1)}" text-anchor="start" font-size="8" fill="#c4b5fd" font-family="Heebo,Arial,sans-serif">${fmtK(Math.round(maxI * pct))}</text>`;
  }).join("");

  // X-axis date labels (dd.m)
  const xLabels = trendData.map((d, i) => {
    if (i !== 0 && i !== n - 1 && i % step !== 0) return "";
    const date = new Date(d.date + "T12:00:00");
    return `<text x="${x(i).toFixed(1)}" y="${H - 9}" text-anchor="middle" font-size="9" fill="#9ca3af" font-family="Heebo,Arial,sans-serif">${date.getDate()}.${date.getMonth() + 1}</text>`;
  }).join("");

  const legend = `
  <div style="display:flex;gap:18px;margin-bottom:8px;font-size:11px;color:#6b7280">
    <span style="display:inline-flex;align-items:center;gap:5px">
      <span style="width:14px;height:3px;background:#1E6FBF;border-radius:2px;display:inline-block"></span>
      סה"כ קליקים${totals ? `<strong style="color:#1E6FBF">${fmtBig(totals.clicks)}</strong>` : ""}
    </span>
    <span style="display:inline-flex;align-items:center;gap:5px">
      <span style="width:14px;height:3px;background:#7C3AED;border-radius:2px;display:inline-block"></span>
      סה"כ הופעות${totals ? `<strong style="color:#7C3AED">${fmtBig(totals.impressions)}</strong>` : ""}
    </span>
  </div>`;

  return `
  ${legend}
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style="display:block;width:100%;height:${H}px">
    <defs>
      <linearGradient id="gscCGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1E6FBF" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="#1E6FBF" stop-opacity="0.01"/>
      </linearGradient>
      <linearGradient id="gscIGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7C3AED" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="#7C3AED" stop-opacity="0.01"/>
      </linearGradient>
    </defs>
    ${gridLines}
    <line x1="${pl}" y1="${(H - pb).toFixed(1)}" x2="${W - pr}" y2="${(H - pb).toFixed(1)}" stroke="#e5e7eb" stroke-width="1"/>
    <polygon points="${iArea}" fill="url(#gscIGrad)"/>
    <polygon points="${cArea}" fill="url(#gscCGrad)"/>
    <polyline points="${iPts}" fill="none" stroke="#7C3AED" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/>
    <polyline points="${cPts}" fill="none" stroke="#1E6FBF" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${xLabels}
  </svg>`;
}

// ── position bar ──────────────────────────────────────────────────────────────

function posBar(pos: number): string {
  if (!pos || pos === 0) return `<span style="color:#9ca3af">-</span>`;
  const color = pos <= 3 ? "#16a34a" : pos <= 10 ? "#1E2D7D" : pos <= 20 ? "#d97706" : "#9ca3af";
  const barW = Math.max(4, Math.min(100, Math.round(100 - (pos / 100) * 88)));
  return `<span style="display:inline-flex;align-items:center;gap:5px;direction:ltr">
    <span style="font-weight:700;color:${color};font-size:12px;min-width:30px">${pos.toFixed(1)}</span>
    <span style="display:inline-block;width:40px;height:4px;background:#e5e7eb;border-radius:2px;overflow:hidden;flex-shrink:0">
      <span style="display:block;width:${barW}%;height:100%;background:${color};border-radius:2px"></span>
    </span>
  </span>`;
}

// Position cell with a trend indicator vs the prior (older) period - mirrors the
// admin keyword panel. Lower rank number = better; the arrow points the way the
// site moved in Google: climbed = green ▲ (number fell), dropped = red ▼ (number
// rose). `prev` 0 → number only.
function posTrendCell(pos: number, prev: number): string {
  if (!pos || pos === 0) return `<span style="color:#9ca3af">-</span>`;
  const color = pos <= 3 ? "#16a34a" : pos <= 10 ? "#1E2D7D" : pos <= 20 ? "#d97706" : "#9ca3af";
  const num = `<span style="font-weight:700;color:${color};font-size:13px">${pos.toFixed(1)}</span>`;
  if (!prev || prev === 0) return num;
  const diff = pos - prev;
  const worse = diff > 0.05, better = diff < -0.05;
  if (!worse && !better) return num;
  const dColor = better ? "#16a34a" : "#dc2626";
  // num first, delta second, in an LTR row → the change sits to the RIGHT of the
  // position number, matching the admin keyword panel.
  return `<span style="display:inline-flex;align-items:center;gap:4px;direction:ltr">
    ${num}
    <span style="font-size:9px;font-weight:600;color:${dColor}">${worse ? "▼" : "▲"}${Math.abs(diff).toFixed(1)}</span>
  </span>`;
}

// "dd.mm–dd.mm" range for a report period - shown under the position column
// headers, mirroring the admin keyword panel.
function dateRange(p: { startDate: string; endDate: string }): string {
  const f = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}.${m}`; };
  return `${f(p.startDate)}–${f(p.endDate)}`;
}

// Small faint sub-line under a header (the period date range).
function thDate(range: string): string {
  return `<div style="font-size:9px;font-weight:400;color:#9ca3af;margin-top:1px">${range}</div>`;
}

// ── section header ────────────────────────────────────────────────────────────

function sectionHeader(title: string, num: string): string {
  return `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #EEF0F9">
    <div style="font-size:17px;font-weight:800;color:#111827;letter-spacing:-0.01em">${title}</div>
    <div style="font-size:11px;font-weight:700;color:#1E2D7D;background:#EEF0F9;padding:3px 10px;border-radius:20px">${num}</div>
  </div>`;
}

// ── source tag ────────────────────────────────────────────────────────────────

function sourceTag(source: "gsc" | "ga4" | "both"): string {
  const gsc = `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;padding:2px 8px;border-radius:20px;line-height:1.5"><span style="width:6px;height:6px;border-radius:50%;background:#16a34a;display:inline-block;flex-shrink:0"></span>Google Search Console</span>`;
  const ga4 = `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;padding:2px 8px;border-radius:20px;line-height:1.5"><span style="width:6px;height:6px;border-radius:50%;background:#ea580c;display:inline-block;flex-shrink:0"></span>Google Analytics 4</span>`;
  const tags = source === "gsc" ? gsc : source === "ga4" ? ga4 : `${gsc}${ga4}`;
  return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:12px"><span style="font-size:10px;color:#9ca3af;font-weight:500">מקור נתונים:</span>${tags}</div>`;
}


// ── main export ───────────────────────────────────────────────────────────────

export function generateReportHtml(data: ReportData, agencyName: string, agencyEmail: string, logoDataUrl = "", cfg: ReportConfig = DEFAULT_REPORT_CONFIG): string {
  const periodLabel = fmtPeriod(data.period.startDate, data.period.endDate);
  const compLabel = fmtPeriod(data.comparisonPeriod.startDate, data.comparisonPeriod.endDate);
  const generatedDate = new Date().toLocaleDateString("he-IL", { day: "2-digit", month: "long", year: "numeric" });

  const hasGa4 = data.ga4.sessions.current > 0;

  // ── section 01: KPIs ──────────────────────────────────────────────────────
  const kpiCards = [
    cfg.kpi_clicks      && kpiCard("קליקים אורגניים", fmtBig(data.gsc.clicks.current), "", data.gsc.clicks, false, fmtBig(data.gsc.clicks.previous)),
    cfg.kpi_impressions && kpiCard("חשיפות", fmtBig(data.gsc.impressions.current), "", data.gsc.impressions, false, fmtBig(data.gsc.impressions.previous)),
    cfg.kpi_ctr         && kpiCard("CTR ממוצע", fmtPct(data.gsc.ctr.current * 100), "", data.gsc.ctr, false, fmtPct(data.gsc.ctr.previous * 100)),
    cfg.kpi_position    && kpiCard("פוזיציה ממוצעת", fmtNum(data.gsc.position.current, 1), "מיקום ממוצע ב-Google", data.gsc.position, true, fmtNum(data.gsc.position.previous, 1)),
  ].filter(Boolean).join("");
  const kpis = kpiCards ? `<div style="display:flex;gap:12px">${kpiCards}</div>` : "";

  // Executive summary text
  const clicksTrend = data.gsc.clicks.improved ? "עלו" : data.gsc.clicks.improved === false ? "ירדו" : "נשארו יציבים";
  const improvedNonBrand = data.keywords.filter(k => !k.isBrand && k.change > 2).length;
  const execText = cfg.exec_summary
    ? `הקליקים האורגניים ${clicksTrend} ב-${fmtPct(Math.abs(data.gsc.clicks.changePct))} בהשוואה ל-${compLabel}.${data.gsc.opportunities.length > 0 ? ` קיימות ${data.gsc.opportunities.length} הזדמנויות SEO עם פוטנציאל חשיפה גבוה.` : ""}${improvedNonBrand > 0 ? ` ${improvedNonBrand} ביטויים עוקבים שיפרו את מיקומם.` : ""}`
    : "";

  // ── section 02: Organic Traffic ──────────────────────────────────────────
  const chart = cfg.trend_chart ? trendChart(data.gsc.trendData, { clicks: data.gsc.clicks.current, impressions: data.gsc.impressions.current }) : "";

  const ga4StatItems = hasGa4 ? [
    cfg.ga4_sessions ? `
    <div style="flex:1;padding-left:20px;border-left:1px solid #E8EAEE">
      <div style="font-size:10px;color:#9ca3af;margin-bottom:3px">סשנים אורגניים</div>
      <div style="font-size:20px;font-weight:700;color:#111827">${fmtBig(data.ga4.sessions.current)}</div>
      ${data.ga4.sessions.change !== 0 ? `<div style="font-size:11px;color:${data.ga4.sessions.improved ? "#16a34a" : "#dc2626"};margin-top:2px">${data.ga4.sessions.improved ? "+" : ""}${fmtPct(data.ga4.sessions.changePct, 1)}</div>` : ""}
    </div>` : "",
    cfg.ga4_revenue ? `
    <div style="flex:1">
      <div style="font-size:10px;color:#9ca3af;margin-bottom:3px">הכנסות כוללות</div>
      <div style="font-size:20px;font-weight:700;color:#111827">₪${fmtBig(data.ga4.revenue.current)}</div>
      ${data.ga4.revenue.change !== 0 ? `<div style="font-size:11px;color:${data.ga4.revenue.improved ? "#16a34a" : "#dc2626"};margin-top:2px">${data.ga4.revenue.improved ? "+" : ""}${fmtPct(data.ga4.revenue.changePct, 1)}</div>` : ""}
    </div>` : "",
  ].filter(Boolean) : [];
  const ga4Stats = ga4StatItems.length
    ? `<div style="display:flex;gap:0;margin-top:16px;padding-top:16px;border-top:1px solid #E8EAEE">${ga4StatItems.join("")}</div>`
    : "";

  // ── section 03: Tracked Keywords ─────────────────────────────────────────
  const keywordRows = data.keywords.map((kw, i) => `
    <tr style="${i % 2 === 0 ? "" : "background:#fafafa"}">
      <td style="padding:9px 14px;font-size:12.5px;color:#1f2937;font-weight:500;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(kw.keyword)}</td>
      <td style="padding:9px 14px;text-align:left;font-size:12px;font-weight:600;color:#111827;font-variant-numeric:tabular-nums">${fmtBig(kw.clicks)}</td>
      <td style="padding:9px 14px;text-align:left;font-size:12px;color:#374151;font-variant-numeric:tabular-nums">${fmtBig(kw.impressions)}</td>
      <td style="padding:9px 14px;text-align:left;font-size:12px;color:#374151">${fmtPct(kw.ctr, 2)}</td>
      <td style="padding:9px 14px;text-align:left">${posTrendCell(kw.prev2Position, 0)}</td>
      <td style="padding:9px 14px;text-align:left">${posTrendCell(kw.prevPosition, kw.prev2Position)}</td>
      <td style="padding:9px 14px;text-align:left">${posTrendCell(kw.position, kw.prevPosition)}</td>
    </tr>`).join("");

  // ── section 04: Top Pages ─────────────────────────────────────────────────
  const topPagesRows = data.gsc.topPages.slice(0, 12).map((p, i) => {
    const prevData = null; // no prev data per page in current structure
    const urlDisplay = (p.page ?? "").replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "") || "/";
    return `
    <tr style="${i % 2 === 0 ? "" : "background:#fafafa"}">
      <td style="padding:9px 14px;font-size:11.5px;color:#4b5563;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace">${esc(urlDisplay)}</td>
      <td style="padding:9px 14px;text-align:left;font-size:12px;font-weight:600;color:#111827;font-variant-numeric:tabular-nums">${fmtBig(p.clicks)}</td>
      <td style="padding:9px 14px;text-align:left;font-size:12px;color:#374151;font-variant-numeric:tabular-nums">${fmtBig(p.impressions)}</td>
      <td style="padding:9px 14px;text-align:left;font-size:12px;color:#374151">${fmtPct(p.ctr * 100, 2)}</td>
      <td style="padding:9px 14px;text-align:left">${posBar(p.position)}</td>
    </tr>`;
  }).join("");

  // ── section 05: GA4 Landing Pages (optional) ──────────────────────────────
  const ga4PagesRows = data.ga4.topLandingPages.slice(0, 10).map((p, i) => {
    const urlDisplay = (p.landingPage ?? "").replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "") || "/";
    return `
    <tr style="${i % 2 === 0 ? "" : "background:#fafafa"}">
      <td style="padding:9px 14px;font-size:11.5px;color:#4b5563;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace">${esc(urlDisplay)}</td>
      <td style="padding:9px 14px;text-align:left;font-size:12px;font-weight:600;color:#111827">${fmtBig(p.sessions)}</td>
      <td style="padding:9px 14px;text-align:left;font-size:12px;color:#374151">${p.keyEvents > 0 ? fmtBig(p.keyEvents) : "-"}</td>
    </tr>`;
  }).join("");


  // ── HTML ──────────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Heebo', Arial, 'Segoe UI', sans-serif;
    color: #1f2937;
    background: white;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    direction: rtl;
  }
  @page { size: A4; margin: 0; }
  @media print {
    .section { page-break-inside: avoid; }
  }
  table { border-collapse: collapse; width: 100%; }
  th { background: #F8F9FB; font-size: 11px; font-weight: 600; color: #6b7280; padding: 9px 14px; text-align: right; border-bottom: 1.5px solid #E8EAEE; vertical-align: top; }
  th.num { text-align: left; }
</style>
</head>
<body>
<div style="width:794px;background:white;">

  <!-- ══ COVER ══ -->
  <div style="background:#1E2D7D;color:white;padding:44px 48px 40px;position:relative;min-height:210px">
    <!-- Logo or branding top-left -->
    <div style="position:absolute;top:36px;left:48px;">
      ${logoDataUrl
        ? `<img src="${esc(logoDataUrl)}" alt="${esc(agencyName)}" style="max-height:48px;max-width:140px;object-fit:contain;display:block;"/>`
        : `<div style="font-size:13px;font-weight:800;opacity:0.45;letter-spacing:0.02em">#RANKEY</div>`
      }
    </div>

    <!-- Tag line -->
    <div style="font-size:11px;font-weight:600;opacity:0.55;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:14px">
      דוח SEO חודשי • ${periodLabel}
    </div>

    <!-- Client name -->
    <div style="font-size:34px;font-weight:800;letter-spacing:-0.02em;margin-bottom:6px;line-height:1.1">${esc(data.client.name)}</div>
    <div style="font-size:15px;opacity:0.7;margin-bottom:28px">${esc(data.client.domain)}</div>

    <!-- Meta row -->
    <div style="display:flex;gap:36px">
      <div>
        <div style="font-size:10px;opacity:0.55;margin-bottom:3px;font-weight:500">תקופת הדוח</div>
        <div style="font-size:13px;font-weight:600">${periodLabel}</div>
      </div>
      <div>
        <div style="font-size:10px;opacity:0.55;margin-bottom:3px;font-weight:500">השוואה ל</div>
        <div style="font-size:13px;font-weight:600">${compLabel}</div>
      </div>
      <div>
        <div style="font-size:10px;opacity:0.55;margin-bottom:3px;font-weight:500">הופק ב</div>
        <div style="font-size:13px;font-weight:600">${generatedDate}</div>
      </div>
      ${agencyEmail ? `<div>
        <div style="font-size:10px;opacity:0.55;margin-bottom:3px;font-weight:500">הכין עבורך</div>
        <div style="font-size:13px;font-weight:600">${esc(agencyEmail)}</div>
      </div>` : ""}
    </div>
  </div>

  <div style="padding:36px 48px">

    <!-- ══ SECTION 01: PERFORMANCE SUMMARY ══ -->
    ${(cfg.kpi_clicks || cfg.kpi_impressions || cfg.kpi_ctr || cfg.kpi_position || cfg.exec_summary) ? `
    <div style="margin-bottom:32px">
      ${sectionHeader("תקציר ביצועים", "01")}
      ${sourceTag("gsc")}
      ${kpis}
      ${execText ? `<div style="margin-top:14px;padding:14px 18px;background:#F8F9FB;border:1px solid #E8EAEE;border-radius:10px;font-size:13px;line-height:1.75;color:#374151">${execText}</div>` : ""}
    </div>` : ""}

    <!-- ══ SECTION 02: ORGANIC TRAFFIC ══ -->
    ${(cfg.trend_chart || cfg.ga4_sessions || cfg.ga4_revenue) ? `
    <div style="margin-bottom:32px;page-break-inside:avoid">
      ${sectionHeader(`תנועה אורגנית – ${periodLabel}`, "02")}
      ${hasGa4 ? sourceTag("both") : sourceTag("gsc")}
      <div style="background:#F8F9FB;border:1.5px solid #E8EAEE;border-radius:12px;padding:20px 20px 16px">
        ${chart}
        ${ga4Stats}
      </div>
    </div>` : ""}

    <!-- ══ SECTION 03: KEYWORDS ══ -->
    ${cfg.keywords_table ? `
    <div style="margin-bottom:32px;page-break-inside:avoid">
      ${sectionHeader("ביטויי מפתח ומיקומים ב-Google", "03")}
      ${sourceTag("gsc")}
      <div style="font-size:11px;color:#9ca3af;margin-bottom:10px">
        ביטויים נבחרים שנבדקים ומעוקבים עבור הלקוח.
      </div>
      <div style="border:1.5px solid #E8EAEE;border-radius:12px;overflow:hidden">
        <table>
          <thead>
            <tr>
              <th>ביטוי</th>
              <th class="num">קליקים</th>
              <th class="num">חשיפות</th>
              <th class="num">CTR</th>
              <th class="num">שתי תקופות אחורה${thDate(dateRange(data.comparisonPeriod2))}</th>
              <th class="num">תקופה קודמת${thDate(dateRange(data.comparisonPeriod))}</th>
              <th class="num">תקופה נוכחית${thDate(dateRange(data.period))}</th>
            </tr>
          </thead>
          <tbody>${keywordRows || `<tr><td colspan="7" style="padding:20px;text-align:center;color:#9ca3af;font-size:12px">לא הוגדרו ביטויים מעוקבים ללקוח זה</td></tr>`}</tbody>
        </table>
      </div>
    </div>` : ""}

    <!-- ══ SECTION 04: TOP PAGES ══ -->
    ${cfg.pages_table ? `
    <div style="margin-bottom:32px;page-break-inside:avoid">
      ${sectionHeader("דפים מובילים", "04")}
      ${sourceTag("gsc")}
      <div style="border:1.5px solid #E8EAEE;border-radius:12px;overflow:hidden">
        <table>
          <thead>
            <tr>
              <th>דף</th>
              <th class="num">קליקים</th>
              <th class="num">חשיפות</th>
              <th class="num">CTR</th>
              <th class="num">פוזיציה</th>
            </tr>
          </thead>
          <tbody>${topPagesRows}</tbody>
        </table>
      </div>
    </div>` : ""}

    <!-- ══ SECTION 05: GA4 PAGES ══ -->
    ${cfg.ga4_pages && hasGa4 && data.ga4.topLandingPages.length > 0 ? `
    <div style="margin-bottom:32px;page-break-inside:avoid">
      ${sectionHeader("דפי נחיתה אורגניים (Analytics)", "05")}
      ${sourceTag("ga4")}
      <div style="border:1.5px solid #E8EAEE;border-radius:12px;overflow:hidden">
        <table>
          <thead>
            <tr>
              <th>דף</th>
              <th class="num">סשנים אורגניים</th>
              <th class="num">Key Events</th>
            </tr>
          </thead>
          <tbody>${ga4PagesRows}</tbody>
        </table>
      </div>
    </div>` : ""}

  </div>

  <!-- ══ FOOTER ══ -->
  <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 48px;background:#F8F9FB;border-top:1.5px solid #E8EAEE;font-size:11px;color:#9ca3af">
    <span>${data.period.startDate} – ${data.period.endDate}</span>
    <span style="font-weight:800;color:#1E2D7D;font-size:13px;letter-spacing:0.02em">#RANKEY</span>
    <span>${esc(agencyName)}${agencyEmail ? " · " + esc(agencyEmail) : ""}</span>
  </div>

</div>
</body>
</html>`;
}
