"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Send, Download, Eye, AlertTriangle, Loader2, Trash2, X, Minus } from "lucide-react";
import { BulkGenerateButton } from "@/app/admin/_components/BulkGenerateModal";

type Report = {
  id: string;
  clientId: string;
  clientName: string;
  clientDomain: string;
  reportMonth: string;
  status: string;
  generatedAt: string | null;
  sentAt: string | null;
  pdfUrl: string | null;
  errorMessage: string | null;
  gscClicks: number;
  openCount: number;
};

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " + new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

function fmtNum(n: number) {
  if (!n) return "—";
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
  return (
    <div className="ava" style={{ background: bg, color: fg }}>{initials}</div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    SENT:      { cls: "success", label: "נשלח" },
    GENERATED: { cls: "info",    label: "דוח מוכן" },
    DRAFT:     { cls: "warn",    label: "ממתין לתנתונים" },
    FAILED:    { cls: "danger",  label: "כשל" },
  };
  const m = map[status] ?? { cls: "neutral", label: status };
  return <span className={`rk-badge ${m.cls}`}><span className="pip" />{m.label}</span>;
}

// ── CSV export ────────────────────────────────────────────────────────────────

function downloadCsv(reports: Report[]) {
  const headers = ["לקוח","דומיין","תקופה","נוצר","נשלח","סטטוס","קליקים","פתיחות"];
  const rows = reports.map(r => [
    r.clientName, r.clientDomain, r.reportMonth,
    fmtDate(r.generatedAt), fmtDate(r.sentAt), r.status,
    r.gscClicks, r.openCount,
  ]);
  const csv = [headers, ...rows].map(row => row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "reports.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── component ─────────────────────────────────────────────────────────────────

export function ReportsTable({ reports: initialReports, months }: { reports: Report[]; months: string[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [reports, setReports] = useState(initialReports);
  const [activeMonth, setActiveMonth] = useState(months[0] ?? "");
  const [clientFilter, setClientFilter] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // unique clients derived from all reports
  const clientOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of reports) seen.set(r.clientId, r.clientName);
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "he"));
  }, [reports]);

  const filtered = useMemo(() => {
    let list = activeMonth ? reports.filter(r => r.reportMonth === activeMonth) : reports;
    if (clientFilter) list = list.filter(r => r.clientId === clientFilter);
    return list;
  }, [reports, activeMonth, clientFilter]);

  const stats = {
    total:   filtered.length,
    sent:    filtered.filter(r => r.status === "SENT").length,
    pending: filtered.filter(r => r.status === "DRAFT" || r.status === "GENERATED").length,
    failed:  filtered.filter(r => r.status === "FAILED").length,
  };

  async function sendReport(reportId: string) {
    setSendingId(reportId);
    try {
      const res = await fetch("/api/reports/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId }),
      });
      if (res.ok) {
        const sentAt = new Date().toISOString();
        setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: "SENT", sentAt } : r));
      }
    } catch { /* ignore */ }
    setSendingId(null);
  }

  async function deleteReport(reportId: string) {
    if (!window.confirm("למחוק את הדוח? פעולה זו אינה הפיכה.")) return;
    setDeletingId(reportId);
    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: "DELETE" });
      if (res.ok) {
        setReports(prev => prev.filter(r => r.id !== reportId));
        startTransition(() => router.refresh());
      }
    } finally {
      setDeletingId(null);
    }
  }

  const allSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id));
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map(r => r.id)));
  }
  function toggleOne(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function bulkDelete() {
    if (!window.confirm(`למחוק ${selected.size} דוחות? פעולה זו אינה הפיכה.`)) return;
    setBulkBusy(true);
    const ids = [...selected];
    await Promise.all(ids.map(id => fetch(`/api/reports/${id}`, { method: "DELETE" })));
    setReports(prev => prev.filter(r => !ids.includes(r.id)));
    setSelected(new Set());
    setBulkBusy(false);
    startTransition(() => router.refresh());
  }

  async function bulkSend() {
    setBulkBusy(true);
    const ids = [...selected].filter(id => filtered.find(r => r.id === id && r.pdfUrl));
    for (const id of ids) {
      await fetch("/api/reports/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: id }),
      });
    }
    const sentAt = new Date().toISOString();
    setReports(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: "SENT", sentAt } : r));
    setSelected(new Set());
    setBulkBusy(false);
    startTransition(() => router.refresh());
  }

  const hasFilters = !!clientFilter;

  return (
    <div className="page">
      {/* Page header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">דוחות</h1>
          <p className="page-sub">כל הדוחות החודשיים שנוצרו ונשלחו, מקובצים לפי תקופה</p>
        </div>
        <div className="page-head-actions">
          <BulkGenerateButton />
          <button onClick={() => downloadCsv(filtered)} className="btn btn-secondary">
            <Download size={14} /> ייצוא הכל
          </button>
        </div>
      </div>

      {/* Month tabs */}
      {months.length > 0 && (
        <div className="tabs" style={{ marginBottom: 12 }}>
          <button
            className={`tab${!activeMonth ? " active" : ""}`}
            onClick={() => setActiveMonth("")}
          >
            הכל
          </button>
          {months.slice(0, 6).map(m => (
            <button
              key={m}
              className={`tab${activeMonth === m ? " active" : ""}`}
              onClick={() => setActiveMonth(m)}
            >
              {fmtMonth(m)}
            </button>
          ))}
        </div>
      )}

      {/* Client filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          style={{
            height: 32, paddingInline: "10px",
            border: "1px solid var(--border)", borderRadius: "var(--r-sm)",
            background: "var(--surface)", fontSize: 12.5,
            fontFamily: "inherit", color: "var(--text)", outline: "none",
            minWidth: 200,
          }}
          dir="rtl"
        >
          <option value="">כל הלקוחות</option>
          {clientOptions.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={() => setClientFilter("")}
            className="btn btn-ghost sm"
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
          >
            <X size={12} /> נקה סינון
          </button>
        )}
        {hasFilters && (
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            מציג {filtered.length} מתוך {activeMonth ? reports.filter(r => r.reportMonth === activeMonth).length : reports.length}
          </span>
        )}
      </div>

      {/* Stats summary + bulk actions */}
      {filtered.length > 0 && (
        <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 13.5, color: "var(--text-muted)", alignItems: "center", flexWrap: "wrap" }}>
          {selected.size > 0 ? (
            <>
              <span style={{ fontWeight: 600, color: "var(--text)" }}>{selected.size} נבחרו</span>
              <button onClick={bulkSend} disabled={bulkBusy} className="btn btn-secondary sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {bulkBusy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} שלח נבחרים
              </button>
              <button onClick={bulkDelete} disabled={bulkBusy} className="btn btn-secondary sm" style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--red)" }}>
                {bulkBusy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} מחק נבחרים
              </button>
              <button onClick={() => setSelected(new Set())} className="btn btn-ghost sm">ביטול</button>
            </>
          ) : (
            <>
              <span style={{ fontWeight: 600, color: "var(--text)" }}>{stats.total} נוצרו</span>
              <span style={{ color: "var(--border-strong)" }}>·</span>
              <span style={{ color: "var(--green)", fontWeight: 600 }}>{stats.sent} נשלחו</span>
              <span style={{ color: "var(--border-strong)" }}>·</span>
              <span style={{ color: "var(--amber)" }}>{stats.pending} ממתינים</span>
              <span style={{ color: "var(--border-strong)" }}>·</span>
              <span style={{ color: "var(--red)" }}>{stats.failed} כשלים</span>
            </>
          )}
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p style={{ marginBottom: 6 }}>אין דוחות{activeMonth ? ` עבור ${fmtMonth(activeMonth)}` : ""}{clientFilter ? ` ללקוח זה` : ""}.</p>
            <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
              פתח לקוח מהרשימה וצור דוח PDF.
            </p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 40, paddingInlineEnd: 0 }}>
                    <button onClick={toggleAll} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24 }}>
                      {allSelected ? (
                        <span style={{ fontSize: 16, color: "var(--accent)" }}>✓</span>
                      ) : someSelected ? (
                        <Minus size={14} style={{ color: "var(--accent)" }} />
                      ) : (
                        <span style={{ width: 14, height: 14, border: "1.5px solid var(--border-strong)", borderRadius: 3, display: "inline-block" }} />
                      )}
                    </button>
                  </th>
                  <th>לקוח</th>
                  <th>תקופה</th>
                  <th>נוצר</th>
                  <th>נשלח</th>
                  <th>סטטוס</th>
                  <th className="hidden-mobile">פתיחות</th>
                  <th style={{ textAlign: "end" }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className={selected.has(r.id) ? "is-selected" : ""}>
                    <td style={{ paddingInlineEnd: 0 }}>
                      <button onClick={() => toggleOne(r.id)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24 }}>
                        {selected.has(r.id)
                          ? <span style={{ fontSize: 16, color: "var(--accent)" }}>✓</span>
                          : <span style={{ width: 14, height: 14, border: "1.5px solid var(--border-strong)", borderRadius: 3, display: "inline-block" }} />}
                      </button>
                    </td>
                    <td>
                      <div className="client-cell">
                        <ClientAvatar name={r.clientName} />
                        <div>
                          <Link href={`/admin/clients/${r.clientId}`} className="nm" style={{ textDecoration: "none", color: "var(--text)" }}>
                            {r.clientName}
                          </Link>
                          <div className="url">{r.clientDomain}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: "var(--text-soft)", fontSize: 13 }}>
                      {fmtMonth(r.reportMonth)}
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: 12.5 }}>
                      {fmtDate(r.generatedAt)}
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: 12.5 }}>
                      {fmtDate(r.sentAt)}
                    </td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="hidden-mobile" style={{ color: "var(--text-muted)", fontSize: 12.5 }}>
                      {r.openCount > 0 ? r.openCount + " פתיחות" : "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 2, justifyContent: "flex-end" }}>
                        {r.pdfUrl && (
                          <>
                            <button
                              onClick={() => sendReport(r.id)}
                              disabled={sendingId === r.id}
                              className="iconbtn"
                              title="שלח"
                            >
                              {sendingId === r.id
                                ? <Loader2 size={13} className="animate-spin" />
                                : <Send size={13} />}
                            </button>
                            <a href={r.pdfUrl} download className="iconbtn" title="הורד PDF">
                              <Download size={13} />
                            </a>
                            <Link href={`/admin/reports/${r.id}`} className="iconbtn" title="צפייה">
                              <Eye size={13} />
                            </Link>
                          </>
                        )}
                        {r.errorMessage && (
                          <span title={r.errorMessage} style={{ color: "var(--red)", cursor: "help", display: "flex" }}>
                            <AlertTriangle size={13} />
                          </span>
                        )}
                        <button
                          onClick={() => deleteReport(r.id)}
                          disabled={deletingId === r.id}
                          className="iconbtn"
                          title="מחק דוח"
                          style={{ color: "var(--red)" }}
                        >
                          {deletingId === r.id
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Trash2 size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border-subtle)", fontSize: 12.5, color: "var(--text-muted)" }}>
            מציג {filtered.length} דוחות
          </div>
        </div>
      )}
    </div>
  );
}
