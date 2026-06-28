"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trash2, Loader2, Minus, Send,
  ExternalLink, Download, RefreshCw, CheckCircle2, XCircle, Mail,
} from "lucide-react";

type Client = {
  id: string;
  name: string;
  domain: string;
  contactEmail: string;
  status: string;
  industry: string;
  reportLanguage: string;
  autoSend: boolean;
  reportSendDay: number;
  hasProperties: boolean;
  gscSiteUrl: string | null;
  lastReportStatus: string | null;
  lastReportDate: string | null;
  nextReportDate: string | null;
  excludeFromReports: boolean;
};

type BulkAction = "delete" | "activate" | "deactivate";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
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

function DataBadge({ has }: { has: boolean }) {
  return has
    ? <span className="rk-badge success"><span className="pip" />מחובר</span>
    : <span className="rk-badge warn"><span className="pip" />חסר נתונים</span>;
}

function ReportBadge({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: "var(--text-faint)", fontSize: 12 }}>-</span>;
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

function downloadCsv(clients: Client[]) {
  const headers = ["שם","דומיין","אימייל","תחום","שפה","סטטוס נתונים","סטטוס דוח","דוח אחרון","דוח הבא"];
  const rows = clients.map(c => [
    c.name, c.domain, c.contactEmail, c.industry,
    c.reportLanguage === "he" ? "עברית" : "אנגלית",
    c.hasProperties ? "מחובר" : "חסר נתונים",
    c.lastReportStatus ?? "",
    fmtDate(c.lastReportDate),
    fmtDate(c.nextReportDate),
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "clients.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── SendAllButton ─────────────────────────────────────────────────────────────

type SendAllResult = { clientName: string; reportMonth: string; ok: boolean; error?: string };
type SendAllState =
  | { phase: "idle" }
  | { phase: "confirm"; count: number }
  | { phase: "sending" }
  | { phase: "done"; sent: number; failed: number; results: SendAllResult[] };

function SendAllButton({ onDone }: { onDone: () => void }) {
  const [state, setState] = useState<SendAllState>({ phase: "idle" });
  const [showDetails, setShowDetails] = useState(false);

  async function load() {
    const res = await fetch("/api/reports/send-all");
    const data = await res.json();
    if (data.count === 0) {
      setState({ phase: "confirm", count: 0 });
    } else {
      setState({ phase: "confirm", count: data.count });
    }
  }

  async function sendAll() {
    setState({ phase: "sending" });
    try {
      const res = await fetch("/api/reports/send-all", { method: "POST" });
      const data = await res.json();
      setState({ phase: "done", sent: data.sent, failed: data.failed, results: data.results ?? [] });
      onDone();
    } catch {
      setState({ phase: "idle" });
    }
  }

  function close() { setState({ phase: "idle" }); setShowDetails(false); }

  if (state.phase === "idle") {
    return (
      <button onClick={load} className="btn btn-primary" style={{ gap: 6, display: "inline-flex", alignItems: "center" }}>
        <Mail size={14} /> שלח דוחות מוכנים
      </button>
    );
  }

  // Overlay modal
  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const box: React.CSSProperties = {
    background: "var(--surface)", borderRadius: "var(--r-lg)", padding: "28px 32px",
    width: 420, maxWidth: "90vw", boxShadow: "var(--shadow-lg)",
    display: "flex", flexDirection: "column", gap: 16,
  };

  if (state.phase === "confirm") {
    return (
      <div style={overlay} onClick={close}>
        <div style={box} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent-soft)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Mail size={18} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>שליחת דוחות מוכנים</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                {state.count === 0
                  ? "אין דוחות מוכנים לשליחה כרגע"
                  : `נמצאו ${state.count} דוחות מוכנים לשליחה`}
              </div>
            </div>
          </div>

          {state.count > 0 && (
            <div style={{ background: "var(--surface-sunken)", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
              המערכת תשלח את כל הדוחות בסטטוס <strong>"דוח מוכן"</strong> ללקוחות שיש להם כתובת מייל מוגדרת.
              לאחר השליחה הסטטוס ישתנה ל<strong>"נשלח"</strong>.
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={close} className="btn btn-ghost">ביטול</button>
            {state.count > 0 && (
              <button onClick={sendAll} className="btn btn-primary" style={{ gap: 6 }}>
                <Send size={13} /> שלח {state.count} דוחות
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === "sending") {
    return (
      <div style={overlay}>
        <div style={box}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)", flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>שולח דוחות...</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>אנא המתן, זה עלול לקחת מספר שניות</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // done
  const { sent, failed, results } = state;
  const failedItems = results.filter(r => !r.ok);
  return (
    <div style={overlay} onClick={close}>
      <div style={{ ...box, maxHeight: "80vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: failed === 0 ? "#E6F4EA" : "#FEF2F2", display: "grid", placeItems: "center", flexShrink: 0 }}>
            {failed === 0
              ? <CheckCircle2 size={20} style={{ color: "#15803D" }} />
              : <XCircle size={20} style={{ color: "var(--red)" }} />}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>השליחה הסתיימה</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              {sent > 0 && <span style={{ color: "#15803D" }}>✓ {sent} נשלחו בהצלחה</span>}
              {sent > 0 && failed > 0 && "  ·  "}
              {failed > 0 && <span style={{ color: "var(--red)" }}>✗ {failed} נכשלו</span>}
            </div>
          </div>
        </div>

        {failedItems.length > 0 && (
          <div>
            <button onClick={() => setShowDetails(p => !p)} className="btn btn-ghost sm" style={{ fontSize: 12 }}>
              {showDetails ? "הסתר פרטים" : "הצג שגיאות"}
            </button>
            {showDetails && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {failedItems.map((r, i) => (
                  <div key={i} style={{ background: "#FEF2F2", borderRadius: 6, padding: "8px 12px", fontSize: 12 }}>
                    <div style={{ fontWeight: 600 }}>{r.clientName}</div>
                    <div style={{ color: "var(--text-muted)", marginTop: 2 }}>{r.error}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={close} className="btn btn-primary">סגור</button>
        </div>
      </div>
    </div>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

export function ClientsTable({ clients, currentMonth }: { clients: Client[]; currentMonth: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);

  function refresh() {
    setRefreshing(true);
    startTransition(() => { router.refresh(); setRefreshing(false); });
  }
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState<BulkAction | null>(null);
  const [confirmSingle, setConfirmSingle] = useState<string | null>(null);
  const [busySingle, setBusySingle] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = clients.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.domain.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === "active")   return c.status === "ACTIVE";
    if (filter === "failed")   return c.lastReportStatus === "FAILED";
    if (filter === "missing")  return !c.hasProperties;
    if (filter === "ready")    return c.lastReportStatus === "GENERATED";
    if (filter === "sent")     return c.lastReportStatus === "SENT";
    return true;
  });

  const filterDefs = [
    { id: "all",     label: "הכל",        count: clients.length },
    { id: "failed",  label: "כשלים",      count: clients.filter(c => c.lastReportStatus === "FAILED").length },
    { id: "missing", label: "חסר נתונים", count: clients.filter(c => !c.hasProperties).length },
    { id: "ready",   label: "דוח מוכן",  count: clients.filter(c => c.lastReportStatus === "GENERATED").length },
    { id: "sent",    label: "נשלח",       count: clients.filter(c => c.lastReportStatus === "SENT").length },
  ];

  const allSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id));
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map(c => c.id)));
  }
  function toggleOne(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function deleteSingle(id: string) {
    setBusySingle(id);
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    setBusySingle(null);
    setConfirmSingle(null);
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    startTransition(() => router.refresh());
  }

  async function executeBulk(action: BulkAction) {
    await fetch("/api/clients/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected], action }),
    });
    setSelected(new Set());
    setConfirmBulk(null);
    startTransition(() => router.refresh());
  }

  const selCount = selected.size;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם או דומיין..."
            style={{
              width: "100%", height: 34, paddingInline: "32px 12px",
              border: "1px solid var(--border)", borderRadius: "var(--r-md)",
              background: "var(--surface)", fontSize: 13,
              fontFamily: "inherit", outline: "none", color: "var(--text)",
            }}
            onFocus={e => (e.target.style.borderColor = "var(--accent)")}
            onBlur={e => (e.target.style.borderColor = "var(--border)")}
          />
          <svg style={{ position: "absolute", insetInlineEnd: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", pointerEvents: "none" }}
            width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
        </div>

        {/* Filter tabs */}
        <div className="tabs" style={{ flex: "0 0 auto" }}>
          {filterDefs.map(f => (
            <button key={f.id} className={`tab${filter === f.id ? " active" : ""}`} onClick={() => setFilter(f.id)}>
              {f.label}<span className="count">{f.count}</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Bulk actions */}
        {selCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{selCount} נבחרו</span>
            {confirmBulk ? (
              <>
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  {confirmBulk === "delete" ? `למחוק ${selCount}?` : confirmBulk === "activate" ? "להפעיל?" : "להשהות?"}
                </span>
                <button onClick={() => executeBulk(confirmBulk)} disabled={isPending}
                  className={`btn btn-primary${confirmBulk === "delete" ? "" : " accent"} sm`}
                  style={confirmBulk === "delete" ? { background: "var(--red)" } : {}}>
                  {isPending && <Loader2 size={12} className="animate-spin" />} אישור
                </button>
                <button onClick={() => setConfirmBulk(null)} className="btn btn-ghost sm">ביטול</button>
              </>
            ) : (
              <>
                <button onClick={() => setConfirmBulk("delete")} className="btn btn-secondary sm" style={{ color: "var(--red)" }}>
                  <Trash2 size={12} /> מחק
                </button>
                <button onClick={() => setSelected(new Set())} className="btn btn-ghost sm">ביטול</button>
              </>
            )}
          </div>
        )}

        {/* Refresh */}
        <button onClick={refresh} disabled={refreshing || isPending} className="btn btn-secondary" style={{ gap: 6 }}>
          <RefreshCw size={14} className={refreshing || isPending ? "animate-spin" : ""} /> רענן
        </button>

        {/* CSV Export */}
        <button onClick={() => downloadCsv(filtered)} className="btn btn-secondary" style={{ gap: 6 }}>
          <Download size={14} /> ייצוא CSV
        </button>

        {/* Send all ready reports */}
        <SendAllButton onDone={refresh} />
      </div>

      {/* Table */}
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
                <th>שם הלקוח</th>
                <th>אתר</th>
                <th className="hidden-mobile">סטטוס נתונים</th>
                <th>סטטוס דוח</th>
                <th className="hidden-mobile">דוח אחרון</th>
                <th className="hidden-mobile">דוח הבא</th>
                <th className="hidden-mobile">שפה</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const isSelected = selected.has(c.id);
                const isBusy     = busySingle === c.id;

                return (
                  <tr
                    key={c.id}
                    className={isSelected ? "is-selected" : ""}
                    onClick={() => router.push(`/admin/clients/${c.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td onClick={e => e.stopPropagation()} style={{ paddingInlineEnd: 0 }}>
                      <button onClick={() => toggleOne(c.id)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24 }}>
                        {isSelected
                          ? <span style={{ fontSize: 16, color: "var(--accent)" }}>✓</span>
                          : <span style={{ width: 14, height: 14, border: "1.5px solid var(--border-strong)", borderRadius: 3, display: "inline-block" }} />}
                      </button>
                    </td>
                    <td>
                      <Link href={`/admin/clients/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                        <div className="client-cell">
                          <ClientAvatar name={c.name} />
                          <div>
                            <div className="nm" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {c.name}
                              {c.excludeFromReports && (
                                <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: "var(--red-soft)", color: "var(--red)", border: "1px solid var(--red-soft-strong)", lineHeight: 1.6, whiteSpace: "nowrap" }}>
                                  מוחרג
                                </span>
                              )}
                            </div>
                            <div className="url">{c.industry || c.domain}</div>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-soft)", fontSize: 12.5 }}>
                        {c.domain}<ExternalLink size={11} style={{ color: "var(--text-faint)" }} />
                      </a>
                    </td>
                    <td className="hidden-mobile"><DataBadge has={c.hasProperties} /></td>
                    <td><ReportBadge status={c.lastReportStatus} /></td>
                    <td className="hidden-mobile" style={{ color: "var(--text-muted)", fontSize: 12.5 }}>
                      {fmtDate(c.lastReportDate)}
                    </td>
                    <td className="hidden-mobile" style={{ color: "var(--text-muted)", fontSize: 12.5 }}>
                      {fmtDate(c.nextReportDate)}
                    </td>
                    <td className="hidden-mobile">
                      <span style={{ fontSize: 12, background: "var(--surface-sunken)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 7px", color: "var(--text-soft)" }}>
                        {c.reportLanguage === "he" ? "עברית" : "אנגלית"}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()} style={{ textAlign: "center" }}>
                      {confirmSingle === c.id ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button onClick={() => deleteSingle(c.id)} disabled={isBusy} className="btn btn-danger sm">
                            {isBusy ? <Loader2 size={11} className="animate-spin" /> : "מחק"}
                          </button>
                          <button onClick={() => setConfirmSingle(null)} className="btn btn-ghost sm">ביטול</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmSingle(c.id)}
                          className="iconbtn"
                          style={{ color: "var(--red)", opacity: 0.5 }}
                          title="מחק לקוח"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", color: "var(--text-faint)", padding: "32px 20px" }}>
                    {search ? `לא נמצאו לקוחות עבור "${search}"` : "אין לקוחות"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 20px", display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-subtle)", fontSize: 12.5, color: "var(--text-muted)" }}>
          <div>מציג {filtered.length} מתוך {clients.length} לקוחות</div>
          <div>1 / 1</div>
        </div>
      </div>
    </div>
  );
}
