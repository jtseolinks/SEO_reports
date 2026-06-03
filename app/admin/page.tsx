export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Users, FileText, Send, AlertTriangle, Clock, Eye,
  RefreshCw, ExternalLink, CheckCircle2, XCircle, MoreHorizontal,
} from "lucide-react";
import { BulkGenerateButton } from "@/app/admin/_components/BulkGenerateModal";
import { DashboardClientsTable } from "@/app/admin/_components/DashboardClientsTable";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("he-IL");
}

function ClientAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const palettes = [
    ["#EEF0F9","#1E2D7D"],["#E6F4EA","#15803D"],["#FDF3E1","#B45309"],
    ["#FEECEB","#B42318"],["#F0EAFE","#6D28D9"],["#E0F4FF","#0369A1"],
    ["#FFF0F6","#C026D3"],["#FFF7ED","#EA580C"],
  ];
  const [bg, fg] = palettes[name.charCodeAt(0) % palettes.length];
  return <div className="ava" style={{ background: bg, color: fg }}>{initials}</div>;
}

function Sparkline({ values, color }: { values: number[]; color?: string }) {
  if (!values.length || values.every(v => v === 0)) {
    return <span style={{ color: "var(--text-faint)", fontSize: 11 }}>—</span>;
  }
  const w = 72, h = 28;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
    const y = h - 2 - ((v - min) / range) * (h - 6);
    return `${x},${y}`;
  }).join(" ");
  const last = values[values.length - 1];
  const prev = values[values.length - 2] ?? last;
  const lineColor = color ?? (last >= prev ? "#15803D" : "#B42318");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="1"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type ReportStatus = "DRAFT" | "GENERATED" | "SENT" | "FAILED";

function ReportStatusBadge({ status }: { status: ReportStatus | string | null }) {
  if (!status) return <span className="rk-badge neutral"><span className="pip" />אין דוח</span>;
  const map: Record<string, { cls: string; label: string }> = {
    SENT:      { cls: "success", label: "נשלח" },
    GENERATED: { cls: "info",    label: "דוח מוכן" },
    DRAFT:     { cls: "warn",    label: "ממתין" },
    FAILED:    { cls: "danger",  label: "כשל" },
  };
  const m = map[status] ?? { cls: "neutral", label: status };
  return <span className={`rk-badge ${m.cls}`}><span className="pip" />{m.label}</span>;
}

function DataStatusBadge({ hasProps }: { hasProps: boolean }) {
  return hasProps
    ? <span className="rk-badge success"><span className="pip" />מחובר</span>
    : <span className="rk-badge warn"><span className="pip" />חסר נתונים</span>;
}

// ── data fetching ─────────────────────────────────────────────────────────────

async function getDashboardData() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalClients,
    newThisMonth,
    reportsThisMonth,
    clients,
    recentReports,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.client.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.monthlyReport.findMany({
      where: { reportMonth: currentMonth },
      select: { status: true },
    }),
    prisma.client.findMany({
      include: {
        googleProperties: true,
        monthlyReports: {
          orderBy: { reportMonth: "desc" },
          take: 6,
          select: {
            id: true, status: true, reportMonth: true,
            sentAt: true, generatedAt: true,
            gscClicks: true, gscImpressions: true, gscPosition: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.monthlyReport.findMany({
      where: { updatedAt: { gte: thirtyDaysAgo } },
      include: { client: { select: { name: true, domain: true } } },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
  ]);

  const sentCount      = reportsThisMonth.filter(r => r.status === "SENT").length;
  const generatedCount = reportsThisMonth.filter(r => r.status === "GENERATED").length;
  const pendingCount   = reportsThisMonth.filter(r => r.status === "DRAFT").length;
  const failedCount    = reportsThisMonth.filter(r => r.status === "FAILED").length;
  const coveredCount   = sentCount + generatedCount;
  const coveragePct    = totalClients > 0 ? Math.round((coveredCount / totalClients) * 100) : 0;

  return {
    totalClients, newThisMonth,
    sentCount, generatedCount, pendingCount, failedCount, coveredCount, coveragePct,
    clients, recentReports, currentMonth,
  };
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  const d = await getDashboardData();

  // Build client rows for the client component
  const clientRows = d.clients.map(client => {
    const currentMonthReport = client.monthlyReports.find(
      r => r.reportMonth === d.currentMonth
    ) ?? null;
    const lastReport  = client.monthlyReports[0] ?? null;
    const prevReport  = client.monthlyReports[1] ?? null;
    return {
      id:                  client.id,
      name:                client.name,
      domain:              client.domain,
      industry:            client.industry,
      autoSend:            client.autoSend,
      reportSendDay:       client.reportSendDay,
      hasProperties:       !!client.googleProperties,
      currentMonthStatus:  currentMonthReport?.status ?? null,
      currentMonthSentAt:  currentMonthReport?.sentAt?.toISOString() ?? null,
      lastReportStatus:    lastReport?.status ?? null,
      lastReportSentAt:    lastReport?.sentAt?.toISOString() ?? null,
      gscClicks:           lastReport?.gscClicks ?? 0,
      gscPosition:         (lastReport as any)?.gscPosition ?? null,
    };
  });

  return (
    <div className="page">
      {/* Page header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">לוח בקרה</h1>
          <p className="page-sub">
            סקירה מהירה של החשבונות הלקוחות ומחזור הדוחות החודשי •{" "}
            {new Date().toLocaleDateString("he-IL", { month: "long", year: "numeric" })}
            {" "}• שלום, Rankey#
          </p>
        </div>
        <div className="page-head-actions">
          <Link href="/admin/clients/import-gsc" className="btn btn-secondary">
            <Users size={14} /> ייבא לקוח מהחשבון
          </Link>
<BulkGenerateButton />
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-label">סך לקוחות</div>
            <div className="kpi-ico blue"><Users size={15} /></div>
          </div>
          <div className="kpi-value">{d.totalClients}</div>
          <div className="kpi-foot">
            {d.newThisMonth > 0 && (
              <span className="rk-badge success" style={{ fontSize: 11 }}>
                +{d.newThisMonth} חדש
              </span>
            )}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-label">דוחות שנוצרו החודש</div>
            <div className="kpi-ico green"><FileText size={15} /></div>
          </div>
          <div className="kpi-value">
            <span style={{ color: "var(--text-muted)", fontSize: 18 }}>{d.totalClients} /</span>
            {" "}{d.coveredCount}
          </div>
          <div className="kpi-foot">
            <span style={{
              color: d.coveragePct >= 80 ? "var(--green)" : "var(--amber)",
              fontWeight: 600, fontSize: 12,
            }}>
              {d.coveragePct}% כיסוי
            </span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-label">ממתינים לשליחה</div>
            <div className="kpi-ico amber"><Clock size={15} /></div>
          </div>
          <div className="kpi-value">{d.pendingCount}</div>
          <div className="kpi-foot">
            <span className="rk-muted" style={{ fontSize: 12 }}>
              {d.generatedCount} מוכנים לשליחה
            </span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-label">נשלחו / שגיאות</div>
            <div className={`kpi-ico ${d.failedCount > 0 ? "red" : "green"}`}>
              {d.failedCount > 0 ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
            </div>
          </div>
          <div className="kpi-value">{d.sentCount}</div>
          <div className="kpi-foot">
            {d.failedCount > 0 && (
              <span className="rk-badge danger" style={{ fontSize: 11 }}>
                {d.failedCount} שגיאות
              </span>
            )}
            {d.failedCount === 0 && d.sentCount > 0 && (
              <span className="rk-badge success" style={{ fontSize: 11 }}>הכל תקין</span>
            )}
          </div>
        </div>
      </div>

      {/* Activity + Feed row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, marginBottom: 16 }}>

        {/* Activity summary */}
        <div className="card">
          <div className="card-head">
            <div>
              <h3 className="card-title">פעילויות חדשות</h3>
              <p className="card-sub">דוחות שנוצרו ונשלחו ב-30 הימים האחרונים</p>
            </div>
          </div>
          <div className="card-pad" style={{ paddingTop: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 20 }}>
              <span style={{ fontSize: 48, fontWeight: 700, letterSpacing: "-2px", color: "var(--text)", lineHeight: 1 }}>
                {d.sentCount + d.generatedCount + d.failedCount}
              </span>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>מ פעולות מ-30 הימים האחרונים</span>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              {[
                { label: "נשלחו", val: d.sentCount, color: "var(--green)" },
                { label: "מוכנים", val: d.generatedCount, color: "var(--accent)" },
                { label: "ממתינים", val: d.pendingCount, color: "var(--amber)" },
                { label: "כשלים", val: d.failedCount, color: "var(--red)" },
              ].map((s) => (
                <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ width: 32, height: 4, borderRadius: 2, background: s.color }} />
                  <span style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent activity feed */}
        <div className="card">
          <div className="card-head">
            <div>
              <h3 className="card-title">פעילות אחרונה</h3>
              <p className="card-sub">עדכונים מהימים ובזמן עבר</p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <span className="rk-badge success"><span className="pip" />נשלח</span>
              <span className="rk-badge neutral"><span className="pip" />נוצר</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {d.recentReports.slice(0, 7).map((r) => {
              const isSuccess = r.status === "SENT";
              const isFailed  = r.status === "FAILED";
              return (
                <div key={r.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 20px", borderBottom: "1px solid var(--border-subtle)",
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: isSuccess ? "var(--green-soft)" : isFailed ? "var(--red-soft)" : "var(--accent-soft)",
                    display: "grid", placeItems: "center",
                    color: isSuccess ? "var(--green)" : isFailed ? "var(--red)" : "var(--accent)",
                  }}>
                    {isSuccess ? <Send size={12} /> : isFailed ? <AlertTriangle size={12} /> : <RefreshCw size={12} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {isSuccess ? `דוח חודשי נשלח ל-${r.client.name}` :
                       isFailed  ? `יצירת דוח ל-${r.client.name} נכשלה` :
                                   `דוח עבור ${r.client.name} בהכנה`}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
                      {r.client.domain} • {fmtDate(r.sentAt ?? r.generatedAt ?? r.updatedAt as unknown as Date)}
                    </div>
                  </div>
                  <Link href={`/admin/clients/${r.clientId}`} className="iconbtn">
                    <ExternalLink size={12} />
                  </Link>
                </div>
              );
            })}
            {d.recentReports.length === 0 && (
              <div style={{ padding: "20px 20px", color: "var(--text-faint)", fontSize: 13, textAlign: "center" }}>
                אין פעילות אחרונה
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Client status table — client component with live refresh */}
      <DashboardClientsTable clients={clientRows} />
    </div>
  );
}
