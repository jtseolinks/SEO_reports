"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Eye, FileText, RefreshCw, Loader2,
  CheckCircle2, AlertTriangle, WifiOff,
  TrendingUp, TrendingDown,
} from "lucide-react";

// ── types ─────────────────────────────────────────────────────────────────────

export type DashClientRow = {
  id: string;
  name: string;
  domain: string;
  industry: string | null;
  autoSend: boolean;
  reportSendDay: number;
  hasProperties: boolean;
  currentMonthStatus: string | null;
  currentMonthSentAt: string | null;
  lastReportStatus: string | null;
  lastReportSentAt: string | null;
  gscClicks: number;
  gscPosition: number | null;
};

type LiveData = {
  connectionOk: boolean;
  error?: string;
  clicks: number;
  impressions: number;
  position: number;
  positionPrev: number | null;
  sessions: number | null;
};

type RowState = "idle" | "loading" | "done" | "error";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
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


function ConnectionBadge({ state, live }: { state: RowState; live?: LiveData }) {
  if (state === "loading")
    return <Loader2 size={13} className="animate-spin" style={{ color: "var(--accent)" }} />;
  if (state === "idle") return null;
  if (!live?.connectionOk)
    return (
      <span className="rk-badge danger" title={live?.error} style={{ fontSize: 11 }}>
        <WifiOff size={10} style={{ marginInlineEnd: 3 }} />שגיאה
      </span>
    );
  return (
    <span className="rk-badge success" style={{ fontSize: 11 }}>
      <CheckCircle2 size={10} style={{ marginInlineEnd: 3 }} />תקין
    </span>
  );
}

function PositionCell({ pos, prev }: { pos: number; prev: number | null }) {
  const change = prev !== null ? prev - pos : null; // positive = improved
  const color = pos <= 3 ? "var(--green)" : pos <= 10 ? "var(--accent)" : pos <= 20 ? "var(--amber)" : "var(--text-muted)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontWeight: 700, fontSize: 13, color }}>{pos.toFixed(1)}</span>
      {change !== null && Math.abs(change) >= 0.3 && (
        <>
          {change > 0
            ? <TrendingUp size={12} style={{ color: "var(--green)" }} />
            : <TrendingDown size={12} style={{ color: "var(--red)" }} />}
          <span style={{ fontSize: 10, color: change > 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
            {change > 0 ? "+" : ""}{change.toFixed(1)}
          </span>
        </>
      )}
    </span>
  );
}

function ReportScheduleBadge({
  autoSend, reportSendDay, currentMonthStatus, currentMonthSentAt,
}: {
  autoSend: boolean;
  reportSendDay: number;
  currentMonthStatus: string | null;
  currentMonthSentAt: string | null;
}) {
  if (!autoSend)
    return <span style={{ color: "var(--text-faint)", fontSize: 11 }}>ידני</span>;

  const now = new Date();
  const dueDate = new Date(now.getFullYear(), now.getMonth(), reportSendDay);
  const isPastDue = now >= dueDate;

  if (currentMonthStatus === "SENT") {
    const sentDay = currentMonthSentAt ? new Date(currentMonthSentAt).getDate() : null;
    const onTime = sentDay !== null && sentDay <= reportSendDay + 3;
    return (
      <span className={`rk-badge ${onTime ? "success" : "info"}`} style={{ fontSize: 11 }}>
        <CheckCircle2 size={10} style={{ marginInlineEnd: 3 }} />
        {onTime ? "נשלח בזמן" : "נשלח באיחור"}
      </span>
    );
  }

  if (isPastDue)
    return (
      <span className="rk-badge danger" style={{ fontSize: 11 }}>
        <AlertTriangle size={10} style={{ marginInlineEnd: 3 }} />לא נשלח
      </span>
    );

  return (
    <span style={{ fontSize: 11, color: "var(--text-faint)" }}>יום {reportSendDay}</span>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function DashboardClientsTable({ clients }: { clients: DashClientRow[] }) {
  const [liveData, setLiveData]   = useState<Record<string, LiveData>>({});
  const [rowState, setRowState]   = useState<Record<string, RowState>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState<"all" | "error" | "unsent" | "missing">("all");

  const hasLive = Object.keys(liveData).length > 0;

  // auto-load on mount
  useEffect(() => { refreshAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshAll() {
    setRefreshing(true);
    const eligible = clients.filter(c => c.hasProperties);
    setRowState(Object.fromEntries(eligible.map(c => [c.id, "loading" as RowState])));

    await Promise.all(
      eligible.map(async (c) => {
        try {
          const res  = await fetch("/api/dashboard/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId: c.id }),
          });
          const data: LiveData = await res.json();
          setLiveData(prev => ({ ...prev, [c.id]: data }));
          setRowState(prev => ({ ...prev, [c.id]: data.connectionOk ? "done" : "error" }));
        } catch {
          const errData: LiveData = {
            connectionOk: false, error: "שגיאת רשת",
            clicks: 0, impressions: 0, position: 0, positionPrev: null, sessions: null,
          };
          setLiveData(prev => ({ ...prev, [c.id]: errData }));
          setRowState(prev => ({ ...prev, [c.id]: "error" }));
        }
      })
    );

    setRefreshing(false);
  }

  const now = new Date();
  const isOverdue = (sendDay: number) => {
    const due = new Date(now.getFullYear(), now.getMonth(), sendDay);
    return now >= due;
  };

  // A client is "missing data" if ANY of the 4 columns is missing:
  // חיבור | קליקים | מיקום ממוצע | תנועה אורגנית
  const isMissingData = (c: DashClientRow) => {
    if (!c.hasProperties) return true;                          // חיבור חסר
    const live = liveData[c.id];
    if (!live) return false;                                    // לא נטען עדיין
    if (!live.connectionOk) return true;                        // שגיאת חיבור
    if (!live.clicks || live.clicks === 0) return true;         // קליקים חסרים
    if (!live.position || live.position === 0) return true;     // מיקום חסר
    const noTraffic = (!live.sessions || live.sessions === 0)   // תנועה אורגנית חסרה
                   && (!live.impressions || live.impressions === 0);
    if (noTraffic) return true;
    return false;
  };

  const tabCounts = {
    all:    clients.length,
    error:  hasLive
      ? clients.filter(c => liveData[c.id] && !liveData[c.id].connectionOk).length
      : 0,
    // "לא נשלח" = last report was NOT sent AND due date has passed
    unsent: clients.filter(c =>
      c.autoSend &&
      c.lastReportStatus !== "SENT" &&
      isOverdue(c.reportSendDay)
    ).length,
    missing: hasLive
      ? clients.filter(isMissingData).length
      : clients.filter(c => !c.hasProperties).length,
  };

  const filtered = clients.filter(c => {
    if (filter === "error")   return hasLive && liveData[c.id] && !liveData[c.id].connectionOk;
    if (filter === "unsent")  return c.autoSend && c.lastReportStatus !== "SENT" && isOverdue(c.reportSendDay);
    if (filter === "missing") return isMissingData(c);
    return true;
  });

  return (
    <div className="card">
      <div className="card-head" style={{ flexWrap: "wrap", gap: 10 }}>
        <div>
          <h3 className="card-title">סטטוס לקוחות</h3>
          <p className="card-sub">כל הלקוחות לפי מצב נתונים ומחזור הדוח החודשי</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div className="tabs" style={{ marginBottom: 0 }}>
            {([
              { id: "all",     label: "הכל",         count: tabCounts.all },
              { id: "error",   label: "בעיות חיבור", count: tabCounts.error },
              { id: "unsent",  label: "לא נשלח",     count: tabCounts.unsent },
              { id: "missing", label: "חסר נתונים",  count: tabCounts.missing },
            ] as const).map(t => (
              <button
                key={t.id}
                className={`tab${filter === t.id ? " active" : ""}`}
                onClick={() => setFilter(t.id)}
              >
                {t.label}<span className="count">{t.count}</span>
              </button>
            ))}
          </div>
          <button
            onClick={refreshAll}
            disabled={refreshing}
            className="btn btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
            title="רענן נתונים חיים מ-Google"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "טוען…" : "רענן"}
          </button>
        </div>
      </div>

      {hasLive && (
        <div style={{
          padding: "6px 20px 8px",
          fontSize: 11.5, color: "var(--text-faint)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
          נתונים חיים ממקור Google •{" "}
          {new Date().toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })}{" "}
          {new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}

      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>לקוח</th>
              <th>חיבור</th>
              <th style={{ textAlign: "left" }}>קליקים</th>
              <th style={{ textAlign: "left" }}>מיקום ממוצע</th>
              <th className="hidden-mobile" style={{ textAlign: "left" }}>תנועה אורגנית</th>
              <th>תזמון דוח</th>
              <th>סטטוס דוח</th>
              <th style={{ textAlign: "end" }}>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const live  = liveData[c.id];
              const state = rowState[c.id] ?? "idle";
              const isLoading = state === "loading";

              const clicks   = live ? live.clicks   : c.gscClicks;
              const position = live ? live.position  : c.gscPosition;

              return (
                <tr
                  key={c.id}
                  onClick={() => { window.location.href = `/admin/clients/${c.id}`; }}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-hover)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                >
                  {/* Client name */}
                  <td>
                    <div className="client-cell">
                      <ClientAvatar name={c.name} />
                      <div>
                        <Link
                          href={`/admin/clients/${c.id}`}
                          className="nm"
                          style={{ textDecoration: "none", color: "var(--text)" }}
                          onClick={e => e.stopPropagation()}
                        >
                          {c.name}
                        </Link>
                        <div className="url">{c.domain}</div>
                      </div>
                    </div>
                  </td>

                  {/* Connection health */}
                  <td onClick={e => e.stopPropagation()}>
                    {state === "idle" ? (
                      c.hasProperties
                        ? <span className="rk-badge success"><span className="pip" />מחובר</span>
                        : <span className="rk-badge warn"><span className="pip" />חסר נתונים</span>
                    ) : (
                      <ConnectionBadge state={state} live={live} />
                    )}
                  </td>

                  {/* Clicks */}
                  <td style={{ textAlign: "left" }}>
                    {isLoading
                      ? <span style={{ color: "var(--text-faint)" }}>…</span>
                      : clicks > 0
                        ? <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtNum(clicks)}</span>
                        : <span style={{ color: "var(--text-faint)" }}>-</span>}
                  </td>

                  {/* Position */}
                  <td style={{ textAlign: "left" }}>
                    {isLoading
                      ? <span style={{ color: "var(--text-faint)" }}>…</span>
                      : position !== null && position > 0
                        ? <PositionCell pos={position} prev={live?.positionPrev ?? null} />
                        : <span style={{ color: "var(--text-faint)" }}>-</span>}
                  </td>

                  {/* Organic traffic */}
                  <td className="hidden-mobile" style={{ textAlign: "left" }}>
                    {isLoading
                      ? <span style={{ color: "var(--text-faint)" }}>…</span>
                      : live?.sessions != null && live.sessions > 0
                        ? <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13 }}>
                            {fmtNum(live.sessions)}
                            <span style={{ fontSize: 10, color: "var(--text-faint)", marginInlineStart: 3 }}>GA4</span>
                          </span>
                        : live?.impressions
                          ? <span style={{ color: "var(--text-muted)", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                              {fmtNum(live.impressions)}
                              <span style={{ fontSize: 10, color: "var(--text-faint)", marginInlineStart: 3 }}>חשיפות</span>
                            </span>
                          : <span style={{ color: "var(--text-faint)" }}>-</span>}
                  </td>

                  {/* Report schedule - shows only the day, no sent/unsent status */}
                  <td>
                    {c.autoSend
                      ? <span style={{ fontSize: 12, color: "var(--text-soft)" }}>יום {c.reportSendDay} לחודש</span>
                      : <span style={{ fontSize: 11, color: "var(--text-faint)" }}>ידני</span>
                    }
                  </td>

                  {/* Report status */}
                  <td onClick={e => e.stopPropagation()}>
                    {(() => {
                      const s = c.lastReportStatus;
                      if (!s) return <span style={{ color: "var(--text-faint)", fontSize: 11 }}>-</span>;
                      if (s === "SENT") return (
                        <span className="rk-badge success" style={{ fontSize: 11 }}>
                          <CheckCircle2 size={10} style={{ marginInlineEnd: 3 }} />נשלח
                        </span>
                      );
                      if (s === "FAILED") return (
                        <span className="rk-badge danger" style={{ fontSize: 11 }}>
                          <AlertTriangle size={10} style={{ marginInlineEnd: 3 }} />נכשל
                        </span>
                      );
                      if (s === "GENERATED") return (
                        <span className="rk-badge info" style={{ fontSize: 11 }}>
                          <FileText size={10} style={{ marginInlineEnd: 3 }} />מוכן לשליחה
                        </span>
                      );
                      return <span style={{ color: "var(--text-faint)", fontSize: 11 }}>{s}</span>;
                    })()}
                  </td>

                  {/* Actions */}
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                      <Link href={`/admin/clients/${c.id}`} className="iconbtn" title="פתח לקוח">
                        <Eye size={14} />
                      </Link>
                      <Link href="/admin/reports" className="iconbtn" title="דוחות">
                        <FileText size={14} />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{
        padding: "10px 20px",
        borderTop: "1px solid var(--border-subtle)",
        fontSize: 12.5, color: "var(--text-muted)",
      }}>
        מציג {filtered.length} מתוך {clients.length} לקוחות
      </div>
    </div>
  );
}
