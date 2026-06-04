"use client";

import { useState, useEffect, useMemo, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, ExternalLink, RefreshCw, Send, Eye, Loader2,
  Plus, X, Download, AlertTriangle, FileText, CheckCircle2,
  Clock, Settings2, Trash2, Minus, FlaskConical,
} from "lucide-react";

import { type ReportConfig, DEFAULT_REPORT_CONFIG, REPORT_SECTIONS, parseReportConfig } from "@/lib/report-config";

// ── types ────────────────────────────────────────────────────────────────────

type Client = {
  id: string; name: string; domain: string; contactEmail: string;
  ccEmails: string[]; reportSendDay: number; status: string; notes: string | null;
  industry: string; reportLanguage: string; autoSend: boolean; createdAt: string;
  brandNameHe: string; brandNameEn: string;
  excludeFromReports: boolean;
  sendDayCustom: boolean;
};
type Properties = {
  gscSiteUrl: string;
  ga4PropertyId: string;
  ga4PropertyName: string | null;
} | null;
type Report = {
  id: string; reportMonth: string; status: string;
  generatedAt: string | null; sentAt: string | null; pdfUrl: string | null;
  errorMessage: string | null; gscClicks: number; gscImpressions: number;
  gscPosition: number; gscCtr: number; recipientCount: number;
};
type LiveData = {
  clicks: number; impressions: number; ctr: number; position: number;
  trendData: { date: string; clicks: number; impressions: number }[];
  ga4: {
    sessions: number;
    revenue: number;
    prevSessions: number;
    prevRevenue: number;
  } | null;
};
type Period = "1m" | "3m" | "6m" | "custom";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString("he-IL");
}
function fmtMonth(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}
function fmtShortDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}
function calcNextReportDate(sendDay: number, autoSend: boolean): Date | null {
  if (!autoSend) return null;
  const now = new Date();
  let d = new Date(now.getFullYear(), now.getMonth(), sendDay);
  if (d <= now) d = new Date(now.getFullYear(), now.getMonth() + 1, sendDay);
  return d;
}
function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

function ClientAvatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const palettes = [
    ["#EEF0F9","#1E2D7D"],["#E6F4EA","#15803D"],["#FDF3E1","#B45309"],
    ["#FEECEB","#B42318"],["#F0EAFE","#6D28D9"],["#E0F4FF","#0369A1"],
    ["#FFF0F6","#C026D3"],["#FFF7ED","#EA580C"],
  ];
  const [bg, fg] = palettes[name.charCodeAt(0) % palettes.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      background: bg, color: fg, fontWeight: 700,
      fontSize: size * 0.36, display: "grid", placeItems: "center",
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function ReportStatusBadge({ status }: { status: string }) {
  if (status === "GENERATING") {
    return (
      <span className="rk-badge info" style={{ gap: 5 }}>
        <Loader2 size={10} className="animate-spin" />בתהליך ייצור
      </span>
    );
  }
  const map: Record<string, { cls: string; label: string }> = {
    SENT:      { cls: "success", label: "נשלח" },
    GENERATED: { cls: "info",    label: "דוח מוכן" },
    DRAFT:     { cls: "warn",    label: "ממתין" },
    FAILED:    { cls: "danger",  label: "כשל" },
  };
  const m = map[status] ?? { cls: "neutral", label: status };
  return <span className={`rk-badge ${m.cls}`}><span className="pip" />{m.label}</span>;
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: value ? "var(--accent)" : "var(--border-strong)",
        border: "none", cursor: disabled ? "not-allowed" : "pointer",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 2,
        insetInlineStart: value ? 18 : 2,
        width: 16, height: 16, borderRadius: "50%",
        background: "white",
        transition: "inset-inline-start 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

// ── main component ───────────────────────────────────────────────────────────

export function ClientDetailPage({
  client: initialClient,
  properties,
  brandKeywords: initialBrandKeywords,
  reports: initialReports,
}: {
  client: Client;
  properties: Properties;
  brandKeywords: string[];
  reports: Report[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [refreshKey, setRefreshKey] = useState(0);

  const [client, setClient] = useState(initialClient);
  const [reports, setReports] = useState(initialReports);
  const [brandKeywords, setBrandKeywords] = useState(initialBrandKeywords);
  const [recipients, setRecipients] = useState<string[]>([
    initialClient.contactEmail, ...initialClient.ccEmails,
  ].filter(Boolean));

  const [saving, setSaving] = useState(false);
  const [newRecipient, setNewRecipient] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [reportsBulkBusy, setReportsBulkBusy] = useState(false);
  const [autoSend, setAutoSend] = useState(initialClient.autoSend);

  // Test-send popover
  const [testSendReportId, setTestSendReportId] = useState<string | null>(null);
  const [testSendEmail, setTestSendEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testSendResult, setTestSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function sendTestReport(reportId: string, email: string) {
    setTestSending(true);
    setTestSendResult(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה בשליחה");
      setTestSendResult({ ok: true, msg: `נשלח בהצלחה אל ${email}` });
    } catch (e) {
      setTestSendResult({ ok: false, msg: e instanceof Error ? e.message : "שגיאה" });
    } finally {
      setTestSending(false);
    }
  }

  // GA4 inline linking
  const [ga4Linking, setGa4Linking] = useState(false);
  const [ga4Props, setGa4Props] = useState<{ propertyId: string; displayName: string }[]>([]);
  const [ga4Loading, setGa4Loading] = useState(false);
  const [ga4Saving, setGa4Saving] = useState(false);
  const [ga4Search, setGa4Search] = useState("");
  const [ga4Selected, setGa4Selected] = useState(properties?.ga4PropertyId ?? "");
  const [currentGa4, setCurrentGa4] = useState(properties?.ga4PropertyId ?? "");
  const [currentGa4Name, setCurrentGa4Name] = useState(properties?.ga4PropertyName ?? "");

  // GSC inline linking
  const [gscLinking, setGscLinking] = useState(false);
  const [gscSites, setGscSites] = useState<{ siteUrl: string; permissionLevel: string }[]>([]);
  const [gscLoading, setGscLoading] = useState(false);
  const [gscError, setGscError] = useState<string | null>(null);
  const [gscSaving, setGscSaving] = useState(false);
  const [gscSearch, setGscSearch] = useState("");
  const [gscSelected, setGscSelected] = useState(properties?.gscSiteUrl ?? "");
  const [currentGscUrl, setCurrentGscUrl] = useState(properties?.gscSiteUrl ?? "");

  async function openGscPicker() {
    setGscLinking(true);
    setGscLoading(true);
    setGscError(null);
    try {
      const res = await fetch("/api/google/gsc-sites");
      const data = await res.json();
      if (!res.ok) { setGscError(data.error ?? `שגיאה ${res.status}`); setGscSites([]); }
      else setGscSites(data.sites ?? []);
    } catch (e) {
      setGscError(e instanceof Error ? e.message : "שגיאת רשת");
    } finally {
      setGscLoading(false);
    }
  }

  async function saveGsc() {
    if (!gscSelected) return;
    setGscSaving(true);
    try {
      const res = await fetch(`/api/clients/${client.id}/properties`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gscSiteUrl:      gscSelected,
          ga4PropertyId:   currentGa4,
          ga4PropertyName: currentGa4Name,
        }),
      });
      if (res.ok) {
        setCurrentGscUrl(gscSelected);
        setGscLinking(false);
        await refreshAll();
      }
    } finally {
      setGscSaving(false);
    }
  }

  async function openGa4Picker() {
    setGa4Linking(true);
    setGa4Loading(true);
    const res = await fetch("/api/google/ga4-properties");
    const data = await res.json();
    setGa4Props(data.properties ?? []);
    setGa4Loading(false);
  }

  async function saveGa4() {
    if (!properties?.gscSiteUrl) return;
    setGa4Saving(true);
    const selected = ga4Props.find(p => p.propertyId === ga4Selected);
    try {
      const res = await fetch(`/api/clients/${client.id}/properties`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gscSiteUrl: properties.gscSiteUrl,
          ga4PropertyId: ga4Selected,
          ga4PropertyName: selected?.displayName ?? "",
        }),
      });
      if (res.ok) {
        setCurrentGa4(ga4Selected);
        setCurrentGa4Name(selected?.displayName ?? "");
        setGa4Linking(false);
        await refreshAll();
      }
    } finally {
      setGa4Saving(false);
    }
  }
  const [ccAgency, setCcAgency] = useState(false);
  const [reportLanguage, setReportLanguage] = useState(initialClient.reportLanguage);
  const [brandNameHe, setBrandNameHe] = useState(initialClient.brandNameHe);
  const [brandNameEn, setBrandNameEn] = useState(initialClient.brandNameEn);
  const [excludeFromReports, setExcludeFromReports] = useState(initialClient.excludeFromReports);
  const [reportSendDay, setReportSendDay] = useState(initialClient.reportSendDay);
  const [sendDayCustom, setSendDayCustom] = useState(initialClient.sendDayCustom);

  // Active period — set by GscLivePanel, used for report generation
  const [activePeriod, setActivePeriod] = useState<{ startDate: string; endDate: string }>(() => {
    const today = new Date();
    const end = today.toISOString().split("T")[0];
    const start = new Date(today);
    start.setDate(start.getDate() - 30);
    return { startDate: start.toISOString().split("T")[0], endDate: end };
  });

  const handlePeriodChange = useCallback((startDate: string, endDate: string) => {
    setActivePeriod({ startDate, endDate });
  }, []);

  const nextDate = calcNextReportDate(reportSendDay, autoSend);
  const latestReport = reports[0] ?? null;

  // Central refresh — re-fetches all client-side data and triggers server re-render
  const refreshAll = useCallback(async () => {
    setRefreshKey(k => k + 1);
    startTransition(() => router.refresh());
    const listRes = await fetch(`/api/clients/${client.id}/reports`);
    if (listRes.ok) setReports(await listRes.json());
  }, [client.id, router]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveSettings() {
    setSaving(true);
    const [contact, ...cc] = recipients;
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportLanguage, autoSend,
          contactEmail: contact ?? client.contactEmail,
          ccEmails: cc,
          reportSendDay, sendDayCustom,
          brandNameHe, brandNameEn, excludeFromReports,
        }),
      });
      if (res.ok) {
        setClient(c => ({ ...c, reportLanguage, autoSend, contactEmail: contact, ccEmails: cc, reportSendDay, sendDayCustom, brandNameHe, brandNameEn, excludeFromReports }));
        // Merge auto-brand terms into the local brandKeywords state
        setBrandKeywords(prev => {
          const autoTerms = [brandNameHe, brandNameEn].filter(Boolean) as string[];
          const manual = prev.filter(kw =>
            kw !== initialClient.brandNameHe && kw !== initialClient.brandNameEn
          );
          return [...new Set([...manual, ...autoTerms])];
        });
        await refreshAll();
      }
    } finally {
      setSaving(false);
    }
  }

  async function generateReport() {
    setGenerating(true);
    setGenError("");
    const reportMonth = activePeriod.startDate.slice(0, 7);

    const optimisticId = `generating-${Date.now()}`;
    setReports(prev => {
      const without = prev.filter(r => r.reportMonth !== reportMonth);
      return [{
        id: optimisticId, reportMonth, status: "GENERATING",
        generatedAt: null, sentAt: null, pdfUrl: null, errorMessage: null,
        gscClicks: 0, gscImpressions: 0, gscPosition: 0, gscCtr: 0, recipientCount: 0,
      }, ...without];
    });

    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          reportMonth,
          startDate: activePeriod.startDate,
          endDate: activePeriod.endDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "שגיאה ביצירת דוח");
    } finally {
      setGenerating(false);
      await refreshAll();
    }
  }

  async function sendReport(reportId: string) {
    setSendingId(reportId);
    setSendResult(null);
    try {
      const res = await fetch("/api/reports/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה בשליחה");
      setSendResult({ id: reportId, ok: true, msg: "הדוח נשלח בהצלחה" });
      await refreshAll();
    } catch (e) {
      setSendResult({ id: reportId, ok: false, msg: e instanceof Error ? e.message : "שגיאה" });
    } finally {
      setSendingId(null);
    }
  }

  async function deleteClient() {
    setDeleting(true);
    await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
    router.push("/admin/clients");
  }

  async function deleteReport(reportId: string) {
    if (!window.confirm("למחוק את הדוח? פעולה זו אינה הפיכה.")) return;
    setDeletingReportId(reportId);
    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: "DELETE" });
      if (res.ok) {
        setReports(prev => prev.filter(r => r.id !== reportId));
        setSelectedReports(prev => { const n = new Set(prev); n.delete(reportId); return n; });
        await refreshAll();
      }
    } finally {
      setDeletingReportId(null);
    }
  }

  const selectableReports = reports.filter(r => r.status !== "GENERATING");
  const allReportsSelected = selectableReports.length > 0 && selectableReports.every(r => selectedReports.has(r.id));
  const someReportsSelected = selectedReports.size > 0 && !allReportsSelected;

  function toggleAllReports() {
    setSelectedReports(allReportsSelected ? new Set() : new Set(selectableReports.map(r => r.id)));
  }
  function toggleOneReport(id: string) {
    setSelectedReports(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function bulkDeleteReports() {
    if (!window.confirm(`למחוק ${selectedReports.size} דוחות? פעולה זו אינה הפיכה.`)) return;
    setReportsBulkBusy(true);
    const ids = [...selectedReports];
    await Promise.all(ids.map(id => fetch(`/api/reports/${id}`, { method: "DELETE" })));
    setReports(prev => prev.filter(r => !ids.includes(r.id)));
    setSelectedReports(new Set());
    setReportsBulkBusy(false);
    await refreshAll();
  }

  async function bulkSendReports() {
    setReportsBulkBusy(true);
    const ids = [...selectedReports].filter(id => reports.find(r => r.id === id && r.pdfUrl));
    for (const id of ids) {
      await fetch("/api/reports/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: id }),
      });
    }
    setSelectedReports(new Set());
    setReportsBulkBusy(false);
    await refreshAll();
  }

  function addRecipient() {
    const v = newRecipient.trim();
    if (v && !recipients.includes(v)) setRecipients(r => [...r, v]);
    setNewRecipient("");
  }
  function removeRecipient(email: string) {
    setRecipients(r => r.filter(e => e !== email));
  }
  async function persistBrandKeywords(next: string[]) {
    await fetch(`/api/clients/${client.id}/brand-keywords`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: next }),
    });
  }

  return (
    <div className="page">
      {/* Breadcrumb */}
      <div style={{ marginBottom: 14 }}>
        <Link href="/admin/clients" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-muted)", fontSize: 13, textDecoration: "none" }}>
          <ChevronLeft size={14} /> חזרה ללקוחות
        </Link>
      </div>

      {/* Page header */}
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <ClientAvatar name={client.name} size={52} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 className="page-title" style={{ marginBottom: 0 }}>{client.name}</h1>
              <span className={`rk-badge ${client.status === "ACTIVE" ? "success" : "neutral"}`}>
                <span className="pip" />{client.status === "ACTIVE" ? "מחובר" : "מושהה"}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>
              {client.industry && <span>{client.industry} · </span>}
              לקוח מאז {fmtDate(client.createdAt)} ·{" "}
              <a href={`https://${client.domain}`} target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--accent)" }}>
                {client.domain} <ExternalLink size={10} style={{ display: "inline", verticalAlign: "middle" }} />
              </a>
            </div>
          </div>
        </div>
        <div className="page-head-actions">
          <button
            onClick={refreshAll}
            disabled={isPending}
            className="btn btn-secondary"
            title="רענן נתונים"
          >
            <RefreshCw size={13} className={isPending ? "animate-spin" : ""} /> רענן
          </button>
          <button
            onClick={generateReport}
            disabled={generating || !properties}
            className="btn btn-primary accent"
          >
            {generating ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
            צור דוח
          </button>
          {latestReport?.pdfUrl && (
            <button
              onClick={() => sendReport(latestReport.id)}
              disabled={sendingId === latestReport.id}
              className="btn btn-secondary"
            >
              {sendingId === latestReport.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              שלח דוח
            </button>
          )}
          {latestReport?.pdfUrl && (
            <a href={latestReport.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              <Eye size={13} /> תצוגה מקדימה
            </a>
          )}
        </div>
      </div>

      {/* ── Full-width: GSC performance panel ── */}
      <GscLivePanel
        clientId={client.id}
        hasProperties={!!properties}
        onPeriodChange={handlePeriodChange}
        refreshKey={refreshKey}
      />

      {/* ── Two-column layout (RTL): sidebar on right | keywords on left ── */}
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 20, alignItems: "start", marginTop: 20 }}>

        {/* ── SIDEBAR (right in RTL, 380px): Google, settings, reports, schedule, red zone ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 16 }}>

          {/* Google integrations */}
          <div className="card">
            <div className="card-head">
              <h3 className="card-title">נכסי הלקוח בחשבון ה-Google שלי</h3>
            </div>
            <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {/* GA4 row */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={integCardStyle}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "#FFF0E6", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 10, color: "#E37400", flexShrink: 0 }}>GA4</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Google Analytics 4</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                      {currentGa4 ? (currentGa4Name || `GA4-${currentGa4}`) : "לא מחובר"}
                    </div>
                  </div>
                  <span className={`rk-badge ${currentGa4 ? "success" : "warn"}`} style={{ fontSize: 10 }}>
                    <span className="pip" />{currentGa4 ? "מחובר" : "לא מחובר"}
                  </span>
                  {properties?.gscSiteUrl && !ga4Linking && (
                    <button onClick={openGa4Picker} className="btn btn-ghost sm" style={{ fontSize: 11, flexShrink: 0 }}>
                      {currentGa4 ? "שנה" : "הגדר"}
                    </button>
                  )}
                </div>

                {/* Inline GA4 picker */}
                {ga4Linking && (
                  <div style={{ padding: "10px 12px", background: "var(--surface-sunken)", borderRadius: "var(--r-md)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
                    {ga4Loading ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-faint)" }}>
                        <Loader2 size={13} className="animate-spin" /> טוען נכסי Analytics...
                      </div>
                    ) : ga4Props.length === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--text-faint)" }}>לא נמצאו נכסי GA4 בחשבון Google</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <input
                          type="text"
                          placeholder="חפש לפי שם נכס או ID..."
                          value={ga4Search}
                          onChange={e => setGa4Search(e.target.value)}
                          style={{ height: 32, paddingInline: "8px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", background: "var(--surface)", fontSize: 12.5, fontFamily: "inherit", color: "var(--text)", outline: "none", width: "100%" }}
                          autoFocus
                          dir="rtl"
                        />
                        <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", background: "var(--surface)" }}>
                          {ga4Props
                            .filter(p => {
                              const q = ga4Search.toLowerCase();
                              return !q || p.displayName.toLowerCase().includes(q) || p.propertyId.includes(q);
                            })
                            .map(p => (
                              <div
                                key={p.propertyId}
                                onClick={() => setGa4Selected(p.propertyId)}
                                style={{
                                  padding: "7px 10px",
                                  cursor: "pointer",
                                  background: ga4Selected === p.propertyId ? "var(--accent-soft)" : "transparent",
                                  borderBottom: "1px solid var(--border-subtle)",
                                  display: "flex", flexDirection: "column", gap: 1,
                                }}
                                onMouseEnter={e => { if (ga4Selected !== p.propertyId) (e.currentTarget as HTMLDivElement).style.background = "var(--surface-hover)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ga4Selected === p.propertyId ? "var(--accent-soft)" : "transparent"; }}
                              >
                                <span style={{ fontSize: 12.5, fontWeight: ga4Selected === p.propertyId ? 600 : 400, color: "var(--text)" }}>{p.displayName}</span>
                                <span style={{ fontSize: 11, color: "var(--text-faint)" }}>ID: {p.propertyId}</span>
                              </div>
                            ))}
                          {ga4Props.filter(p => {
                            const q = ga4Search.toLowerCase();
                            return !q || p.displayName.toLowerCase().includes(q) || p.propertyId.includes(q);
                          }).length === 0 && (
                            <div style={{ padding: "12px 10px", fontSize: 12, color: "var(--text-faint)", textAlign: "center" }}>
                              לא נמצאו תוצאות
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={saveGa4}
                        disabled={ga4Saving || !ga4Selected}
                        className="btn btn-primary accent sm"
                      >
                        {ga4Saving ? <Loader2 size={11} className="animate-spin" /> : null} שמור
                      </button>
                      <button onClick={() => setGa4Linking(false)} className="btn btn-ghost sm">ביטול</button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={integCardStyle}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "#E8F4FF", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 10, color: "#1E6FBF", flexShrink: 0 }}>GSC</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Google Search Console</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {currentGscUrl || "לא מחובר"}
                    </div>
                  </div>
                  <span className={`rk-badge ${currentGscUrl ? "success" : "warn"}`} style={{ fontSize: 10 }}>
                    <span className="pip" />{currentGscUrl ? "מחובר" : "לא מחובר"}
                  </span>
                  {!gscLinking && (
                    <button onClick={openGscPicker} className="btn btn-ghost sm" style={{ fontSize: 11, flexShrink: 0 }}>
                      {currentGscUrl ? "שנה" : "הגדר"}
                    </button>
                  )}
                </div>

                {/* Inline GSC picker */}
                {gscLinking && (
                  <div style={{ padding: "10px 12px", background: "var(--surface-sunken)", borderRadius: "var(--r-md)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
                    {gscError ? (
                      <div style={{ fontSize: 12, color: "var(--red)" }}><strong>שגיאה:</strong> {gscError}</div>
                    ) : gscLoading ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-faint)" }}>
                        <Loader2 size={13} className="animate-spin" /> טוען נכסי Search Console...
                      </div>
                    ) : gscSites.length === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--text-faint)" }}>לא נמצאו נכסים בחשבון Google</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <input
                          type="text" placeholder="חפש נכס..." value={gscSearch}
                          onChange={e => setGscSearch(e.target.value)}
                          style={{ height: 32, paddingInline: "8px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", background: "var(--surface)", fontSize: 12.5, fontFamily: "inherit", color: "var(--text)", outline: "none", width: "100%" }}
                          autoFocus dir="ltr"
                        />
                        <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", background: "var(--surface)" }}>
                          {gscSites
                            .filter(s => !gscSearch || s.siteUrl.toLowerCase().includes(gscSearch.toLowerCase()))
                            .map(s => {
                              const isSelected = gscSelected === s.siteUrl;
                              const isDomain = s.siteUrl.startsWith("sc-domain:");
                              return (
                                <div key={s.siteUrl} onClick={() => setGscSelected(s.siteUrl)}
                                  style={{ padding: "7px 10px", cursor: "pointer", background: isSelected ? "var(--accent-soft)" : "transparent", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.siteUrl}</span>
                                    <span style={{ fontSize: 10, color: "var(--text-faint)" }}>{s.permissionLevel}</span>
                                  </div>
                                  <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: isDomain ? "#EEF0F9" : "#E6F4EA", color: isDomain ? "#1E2D7D" : "#15803D", flexShrink: 0 }}>
                                    {isDomain ? "Domain" : "URL"}
                                  </span>
                                </div>
                              );
                            })}
                          {gscSites.filter(s => !gscSearch || s.siteUrl.toLowerCase().includes(gscSearch.toLowerCase())).length === 0 && (
                            <div style={{ padding: "12px 10px", fontSize: 12, color: "var(--text-faint)", textAlign: "center" }}>לא נמצאו תוצאות</div>
                          )}
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={saveGsc} disabled={gscSaving || !gscSelected} className="btn btn-primary accent sm">
                        {gscSaving ? <Loader2 size={11} className="animate-spin" /> : null} שמור
                      </button>
                      <button onClick={() => setGscLinking(false)} className="btn btn-ghost sm">ביטול</button>
                    </div>
                  </div>
                )}
              </div>


              {!properties && (
                <Link href="/admin/clients/import-gsc" className="btn btn-secondary" style={{ justifyContent: "center" }}>
                  <Plus size={13} /> חבר נכסי Google
                </Link>
              )}
            </div>
          </div>

          {/* Report settings */}
          <div className="card">
            <div className="card-head">
              <h3 className="card-title">הגדרות דוח</h3>
              <button onClick={saveSettings} disabled={saving} className="btn btn-secondary sm">
                {saving ? <Loader2 size={11} className="animate-spin" /> : null} שמור
              </button>
            </div>
            <div className="card-pad" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 16 }}>

              <div style={settingsRowStyle}>
                <span style={settingsLabelStyle}>תדירות דוח</span>
                <div style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "4px 10px", fontSize: 13, color: "var(--text-soft)" }}>
                  חודשי ▾
                </div>
              </div>

              <div style={settingsRowStyle}>
                <span style={settingsLabelStyle}>שפת הדוח</span>
                <select
                  value={reportLanguage}
                  onChange={e => setReportLanguage(e.target.value)}
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "4px 10px", fontSize: 13, fontFamily: "inherit", color: "var(--text)", outline: "none", cursor: "pointer" }}
                >
                  <option value="he">עברית</option>
                  <option value="en">אנגלית</option>
                </select>
              </div>

              {/* Brand name exclusions */}
              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", marginBottom: 3 }}>שם המותג להחרגה</div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 10 }}>
                  ביטויים המכילים את השמות הללו יסוננו מטבלת מילות המפתח
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>שם בעברית</label>
                    <input
                      type="text"
                      value={brandNameHe}
                      onChange={e => setBrandNameHe(e.target.value)}
                      placeholder="לדוגמה: רנקי"
                      style={{ width: "100%", height: 32, paddingInline: "10px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", background: "var(--surface)", fontSize: 12.5, fontFamily: "inherit", color: "var(--text)", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>שם באנגלית</label>
                    <input
                      type="text"
                      value={brandNameEn}
                      onChange={e => setBrandNameEn(e.target.value)}
                      placeholder="e.g. Rankey"
                      dir="ltr"
                      style={{ width: "100%", height: 32, paddingInline: "10px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", background: "var(--surface)", fontSize: 12.5, fontFamily: "inherit", color: "var(--text)", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div style={settingsLabelStyle}>נמענים</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {recipients.map(email => (
                    <div key={email} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: "var(--surface-sunken)", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}>
                      <span style={{ flex: 1, fontSize: 13, color: "var(--text-soft)" }}>{email}</span>
                      <button onClick={() => removeRecipient(email)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", padding: 2, display: "flex" }}>
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="email" value={newRecipient}
                      onChange={e => setNewRecipient(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addRecipient()}
                      placeholder="הוסף נמען..."
                      style={{ flex: 1, height: 32, paddingInline: "10px", border: "1px dashed var(--border-strong)", borderRadius: "var(--r-sm)", background: "transparent", fontSize: 12.5, fontFamily: "inherit", outline: "none", color: "var(--text)" }}
                    />
                    <button onClick={addRecipient} className="btn btn-ghost sm"><Plus size={13} /> הוסף</button>
                  </div>
                </div>
              </div>


              {/* Exclude from reports — prominent warning row */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", borderRadius: "var(--r-md)",
                background: excludeFromReports ? "var(--red-soft)" : "var(--surface-sunken)",
                border: `1px solid ${excludeFromReports ? "var(--red-soft-strong)" : "var(--border)"}`,
                transition: "all 0.2s",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: excludeFromReports ? "var(--red)" : "var(--text)" }}>
                    מוחרג מדוחות
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
                    {excludeFromReports ? "ייצור ושליחת דוחות מושבתים ללקוח זה" : "לקוח פעיל — דוחות מופקים כרגיל"}
                  </div>
                </div>
                <Toggle value={excludeFromReports} onChange={v => { setExcludeFromReports(v); if (v) setAutoSend(false); }} />
              </div>

              <div style={settingsRowStyle}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>שליחה אוטומטית</div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
                    {autoSend ? `יום ${reportSendDay} לכל חודש, 09:00` : "כבוי"}
                  </div>
                </div>
                <Toggle value={autoSend} onChange={setAutoSend} disabled={excludeFromReports} />
              </div>

              {/* Per-client send day override */}
              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>יום שליחה בחודש</span>
                      {sendDayCustom && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
                          מותאם אישית
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                      {sendDayCustom ? "ייחודי ללקוח זה — לא יושפע משינוי כללי" : "מסונכרן עם הגדרת ברירת המחדל"}
                    </div>
                  </div>
                  {sendDayCustom && (
                    <button
                      className="btn btn-ghost sm"
                      style={{ fontSize: 11, color: "var(--text-muted)" }}
                      onClick={() => { setSendDayCustom(false); }}
                      title="חזור לברירת מחדל"
                    >
                      ×‎ אפס
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number"
                    min={1} max={28}
                    value={reportSendDay}
                    onChange={e => {
                      const v = Math.min(28, Math.max(1, parseInt(e.target.value) || 1));
                      setReportSendDay(v);
                      setSendDayCustom(true);
                    }}
                    style={{ width: 64, height: 32, paddingInline: "10px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", background: "var(--surface)", fontSize: 13, fontFamily: "inherit", color: "var(--text)", outline: "none", textAlign: "center" }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text-faint)" }}>לכל חודש (1–28)</span>
                </div>
              </div>

              <div style={settingsRowStyle}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>שלח עותק לסוכנות</div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{client.contactEmail}</div>
                </div>
                <Toggle value={ccAgency} onChange={setCcAgency} />
              </div>
            </div>
          </div>

          {/* Error / success banners */}
          {genError && (
            <div style={{ padding: "10px 14px", background: "var(--red-soft)", border: "1px solid var(--red-soft-strong)", borderRadius: "var(--r-md)", color: "var(--red)", fontSize: 13, display: "flex", gap: 8 }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />{genError}
            </div>
          )}
          {sendResult && (
            <div style={{ padding: "10px 14px", background: sendResult.ok ? "var(--green-soft)" : "var(--red-soft)", border: `1px solid ${sendResult.ok ? "var(--green-soft-strong)" : "var(--red-soft-strong)"}`, borderRadius: "var(--r-md)", color: sendResult.ok ? "var(--green)" : "var(--red)", fontSize: 13 }}>
              {sendResult.msg}
            </div>
          )}

          {/* Test-send dialog */}
          {testSendReportId && (
            <div className="card" style={{ border: "1.5px solid var(--accent)" }}>
              <div className="card-head">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FlaskConical size={14} style={{ color: "var(--accent)" }} />
                  <h3 className="card-title" style={{ marginBottom: 0 }}>שליחת ניסיון</h3>
                </div>
                <button onClick={() => { setTestSendReportId(null); setTestSendResult(null); }} className="btn btn-ghost sm">
                  <X size={13} />
                </button>
              </div>
              <div className="card-pad" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>
                  המייל יישלח לכתובת שתזין, ולא ללקוח. הסטטוס לא ישתנה.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="email"
                    value={testSendEmail}
                    onChange={e => { setTestSendEmail(e.target.value); setTestSendResult(null); }}
                    onKeyDown={e => e.key === "Enter" && testSendEmail && !testSending && sendTestReport(testSendReportId, testSendEmail)}
                    placeholder="your@email.com"
                    dir="ltr"
                    style={{ flex: 1, height: 34, paddingInline: "10px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", background: "var(--surface)", fontSize: 13, fontFamily: "inherit", color: "var(--text)", outline: "none" }}
                  />
                  <button
                    onClick={() => sendTestReport(testSendReportId, testSendEmail)}
                    disabled={testSending || !testSendEmail}
                    className="btn btn-primary accent sm"
                  >
                    {testSending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    {testSending ? "שולח..." : "שלח"}
                  </button>
                </div>
                {testSendResult && (
                  <div style={{ fontSize: 12.5, padding: "7px 10px", borderRadius: "var(--r-sm)", background: testSendResult.ok ? "var(--green-soft)" : "var(--red-soft)", color: testSendResult.ok ? "var(--green)" : "var(--red)" }}>
                    {testSendResult.msg}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Latest report */}
          {latestReport && (
            <div className="card">
              <div className="card-head">
                <div>
                  <h3 className="card-title">דוח אחרון — {fmtMonth(latestReport.reportMonth)}</h3>
                  <p className="card-sub">
                    נוצר {fmtDate(latestReport.generatedAt)} · {fmtDate(latestReport.sentAt) !== "—" ? `נשלח ${fmtDate(latestReport.sentAt)}` : "טרם נשלח"}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {latestReport.pdfUrl && (
                    <>
                      <button
                        onClick={() => {
                          setTestSendReportId(latestReport.id);
                          setTestSendEmail("");
                          setTestSendResult(null);
                        }}
                        className="btn btn-ghost sm"
                        title="שלח ניסיון לאימייל שלך"
                      >
                        <FlaskConical size={12} /> ניסיון
                      </button>
                      <a href={latestReport.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary sm">
                        <Eye size={12} /> תצוגה מלאה
                      </a>
                      <a href={latestReport.pdfUrl} download className="btn btn-ghost sm">
                        <Download size={12} /> PDF
                      </a>
                    </>
                  )}
                </div>
              </div>

              {/* Mini preview */}
              <div style={{ margin: "0 20px 20px", borderRadius: "var(--r-lg)", overflow: "hidden", border: "1px solid var(--border)" }}>
                <div style={{ background: "var(--brand-navy)", padding: "16px 20px", color: "white" }}>
                  <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>דוח חודשי • Rankey#</div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{client.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{fmtMonth(latestReport.reportMonth)}</div>
                </div>
                <div style={{ background: "var(--surface)", padding: "14px 20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {[
                    { label: "קליקים", val: fmtNum(latestReport.gscClicks) },
                    { label: "חשיפות", val: fmtNum(latestReport.gscImpressions) },
                    { label: "פוזיציה", val: latestReport.gscPosition > 0 ? latestReport.gscPosition.toFixed(1) : "—" },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{s.val || "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Generate for selected period */}
              <div style={{ padding: "12px 20px 16px", borderTop: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                  צור דוח לתקופה שנבחרה: <strong>{fmtShortDate(activePeriod.startDate)} – {fmtShortDate(activePeriod.endDate)}</strong>
                </div>
                <button onClick={generateReport} disabled={generating || !properties} className="btn btn-secondary sm">
                  {generating ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                  {generating ? "יוצר..." : "צור דוח"}
                </button>
              </div>
            </div>
          )}

          {/* No report yet */}
          {!latestReport && (
            <div className="card">
              <div className="card-pad" style={{ textAlign: "center", padding: "32px 20px 24px" }}>
                <FileText size={40} style={{ color: "var(--text-faint)", marginBottom: 12, margin: "0 auto 12px" }} />
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>אין דוחות עדיין</div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
                  {properties ? "בחר תקופה בגרף למעלה וצור דוח" : "חבר נכסי Google כדי ליצור דוחות"}
                </p>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                  תקופה נבחרת: <strong>{fmtShortDate(activePeriod.startDate)} – {fmtShortDate(activePeriod.endDate)}</strong>
                </div>
                <button onClick={generateReport} disabled={generating || !properties} className="btn btn-primary accent sm">
                  {generating ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                  {generating ? "יוצר..." : "צור דוח חדש"}
                </button>
              </div>
            </div>
          )}

          {/* Report history */}
          {reports.length > 0 && (
            <div className="card">
              <div className="card-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h3 className="card-title">היסטוריית דוחות</h3>
                  <p className="card-sub">12 החודשים האחרונים</p>
                </div>
                {selectedReports.size > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{selectedReports.size} נבחרו</span>
                    <button onClick={bulkSendReports} disabled={reportsBulkBusy} className="btn btn-secondary sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {reportsBulkBusy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} שלח
                    </button>
                    <button onClick={bulkDeleteReports} disabled={reportsBulkBusy} className="btn btn-secondary sm" style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--red)" }}>
                      {reportsBulkBusy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} מחק
                    </button>
                    <button onClick={() => setSelectedReports(new Set())} className="btn btn-ghost sm">ביטול</button>
                  </div>
                )}
              </div>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 40, paddingInlineEnd: 0 }}>
                        <button onClick={toggleAllReports} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24 }}>
                          {allReportsSelected ? <span style={{ fontSize: 16, color: "var(--accent)" }}>✓</span>
                            : someReportsSelected ? <Minus size={14} style={{ color: "var(--accent)" }} />
                            : <span style={{ width: 14, height: 14, border: "1.5px solid var(--border-strong)", borderRadius: 3, display: "inline-block" }} />}
                        </button>
                      </th>
                      <th>תקופה</th>
                      <th>סטטוס</th>
                      <th style={{ textAlign: "end" }}>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(r => (
                      <tr key={r.id} className={selectedReports.has(r.id) ? "is-selected" : ""}>
                        <td style={{ paddingInlineEnd: 0 }}>
                          {r.status !== "GENERATING" && (
                            <button onClick={() => toggleOneReport(r.id)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24 }}>
                              {selectedReports.has(r.id)
                                ? <span style={{ fontSize: 16, color: "var(--accent)" }}>✓</span>
                                : <span style={{ width: 14, height: 14, border: "1.5px solid var(--border-strong)", borderRadius: 3, display: "inline-block" }} />}
                            </button>
                          )}
                        </td>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{fmtMonth(r.reportMonth)}</td>
                        <td><ReportStatusBadge status={r.status} /></td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                            {r.pdfUrl && (
                              <>
                                <button onClick={() => sendReport(r.id)} disabled={sendingId === r.id} className="iconbtn" title="שלח ללקוח">
                                  {sendingId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                </button>
                                <button
                                  onClick={() => {
                                    setTestSendReportId(r.id);
                                    setTestSendEmail("");
                                    setTestSendResult(null);
                                  }}
                                  className="iconbtn"
                                  title="שלח ניסיון"
                                  style={{ color: "var(--accent)" }}
                                >
                                  <FlaskConical size={13} />
                                </button>
                                <a href={r.pdfUrl} download className="iconbtn" title="הורד PDF"><Download size={13} /></a>
                                <Link href={`/admin/reports/${r.id}`} className="iconbtn" title="צפייה"><Eye size={13} /></Link>
                              </>
                            )}
                            {r.status !== "GENERATING" && (
                              <button onClick={generateReport} disabled={generating} className="iconbtn" title="צור מחדש">
                                <RefreshCw size={13} />
                              </button>
                            )}
                            {r.errorMessage && (
                              <span title={r.errorMessage} style={{ color: "var(--red)", cursor: "help" }}>
                                <AlertTriangle size={13} />
                              </span>
                            )}
                            {r.status !== "GENERATING" && (
                              <button onClick={() => deleteReport(r.id)} disabled={deletingReportId === r.id} className="iconbtn" title="מחק דוח" style={{ color: "var(--red)" }}>
                                {deletingReportId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Schedule */}
          <div className="card">
            <div className="card-head">
              <h3 className="card-title">לוח זמנים</h3>
            </div>
            <div className="card-pad" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--accent-soft)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Clock size={16} style={{ color: "var(--accent)" }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-faint)" }}>הדוח הבא</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                    {nextDate ? fmtDate(nextDate.toISOString()) : "—"}
                  </div>
                  {nextDate && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      בעוד {daysUntil(nextDate)} ימים
                    </div>
                  )}
                </div>
              </div>
              {nextDate && (
                <div style={{ fontSize: 12, color: "var(--text-faint)", padding: "8px 12px", background: "var(--surface-sunken)", borderRadius: "var(--r-sm)" }}>
                  <Clock size={11} style={{ display: "inline", verticalAlign: "middle", marginInlineEnd: 4 }} />
                  איסוף נתונים יתחיל ב-{fmtDate(new Date(nextDate.getTime() - 2 * 86_400_000).toISOString())} בשעה 22:00
                </div>
              )}
            </div>
          </div>

          {/* Red zone */}
          <div className="card" style={{ borderColor: "var(--red-soft-strong)" }}>
            <div className="card-head">
              <h3 className="card-title" style={{ color: "var(--red)" }}>אזור אדום</h3>
            </div>
            <div className="card-pad" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={saveSettings} className="btn btn-secondary" style={{ justifyContent: "flex-start", color: "var(--amber)" }}>
                <Clock size={14} /> השהה דוחות אוטומטיים
              </button>
              {confirmDelete ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--red-soft)", borderRadius: "var(--r-sm)" }}>
                  <span style={{ fontSize: 13, flex: 1, color: "var(--red)" }}>האם למחוק את {client.name}?</span>
                  <button onClick={deleteClient} disabled={deleting} className="btn btn-danger sm">
                    {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} מחק
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="btn btn-ghost sm">ביטול</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="btn btn-secondary" style={{ justifyContent: "flex-start", color: "var(--red)", borderColor: "var(--red-soft-strong)" }}>
                  <Trash2 size={14} /> מחיקת לקוח
                </button>
              )}
            </div>
          </div>

        </div>{/* end sidebar */}

        {/* ── MAIN (left in RTL, 1fr): keywords only ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          <ReportConfigPanel clientId={client.id} />

          <KeywordsPanel
            clientId={client.id}
            hasProperties={!!properties}
            brandKeywords={brandKeywords}
            activePeriod={activePeriod}
            onBrandKeywordsChange={(next) => {
              setBrandKeywords(next);
              persistBrandKeywords(next);
            }}
          />

        </div>{/* end main column */}
      </div>{/* end two-column grid */}
    </div>
  );
}

// ── Dual-line GSC chart ───────────────────────────────────────────────────────

function DualLineChart({ trendData, loading }: {
  trendData: { date: string; clicks: number; impressions: number }[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", height: 200, background: "var(--surface-sunken)", borderRadius: "var(--r-sm)", opacity: 0.6 }} />
      </div>
    );
  }

  if (!trendData || trendData.length < 2) {
    return (
      <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: 12 }}>
        אין נתוני מגמה זמינים
      </div>
    );
  }

  const SVG_W = 700, H = 240;
  const pt = 14, pb = 30, pl = 44, pr = 44;
  const chartW = SVG_W - pl - pr;
  const chartH = H - pt - pb;
  const n = trendData.length;

  const maxC = Math.max(...trendData.map(d => d.clicks), 1);
  const maxI = Math.max(...trendData.map(d => d.impressions), 1);

  const xPos = (i: number) => pl + (i / Math.max(n - 1, 1)) * chartW;
  const yC = (v: number) => pt + (1 - v / maxC) * chartH;
  const yI = (v: number) => pt + (1 - v / maxI) * chartH;

  const cPts = trendData.map((d, i) => `${xPos(i).toFixed(1)},${yC(d.clicks).toFixed(1)}`).join(" ");
  const iPts = trendData.map((d, i) => `${xPos(i).toFixed(1)},${yI(d.impressions).toFixed(1)}`).join(" ");
  const cArea = `${xPos(0).toFixed(1)},${(H - pb).toFixed(1)} ${cPts} ${xPos(n - 1).toFixed(1)},${(H - pb).toFixed(1)}`;
  const iArea = `${xPos(0).toFixed(1)},${(H - pb).toFixed(1)} ${iPts} ${xPos(n - 1).toFixed(1)},${(H - pb).toFixed(1)}`;

  const step = Math.max(1, Math.ceil(n / 7));
  const fmtK = (v: number) => v >= 1000 ? (v / 1000).toFixed(1).replace(/\.0$/, "") + "K" : String(v);
  const gridPcts = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${SVG_W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H, display: "block" }}>
      <defs>
        <linearGradient id="gsc-c-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1E6FBF" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#1E6FBF" stopOpacity="0.01" />
        </linearGradient>
        <linearGradient id="gsc-i-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Horizontal grid lines + Y labels */}
      {gridPcts.map(pct => {
        const yv = pt + (1 - pct) * chartH;
        return (
          <g key={pct}>
            <line x1={pl} y1={yv} x2={SVG_W - pr} y2={yv} stroke="#f1f5f9" strokeWidth="1" />
            <text x={pl - 5} y={yv + 3.5} textAnchor="end" fontSize="8" fill="#93c5fd">
              {fmtK(Math.round(maxC * pct))}
            </text>
            <text x={SVG_W - pr + 5} y={yv + 3.5} textAnchor="start" fontSize="8" fill="#c4b5fd">
              {fmtK(Math.round(maxI * pct))}
            </text>
          </g>
        );
      })}

      {/* Bottom axis line */}
      <line x1={pl} y1={H - pb} x2={SVG_W - pr} y2={H - pb} stroke="#e5e7eb" strokeWidth="1" />

      {/* Filled areas */}
      <polygon points={iArea} fill="url(#gsc-i-grad)" />
      <polygon points={cArea} fill="url(#gsc-c-grad)" />

      {/* Lines */}
      <polyline points={iPts} fill="none" stroke="#7C3AED" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={cPts} fill="none" stroke="#1E6FBF" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* X axis date labels */}
      {trendData.map((d, i) => {
        if (i !== 0 && i !== n - 1 && i % step !== 0) return null;
        const date = new Date(d.date + "T12:00:00");
        const label = `${date.getDate()}.${date.getMonth() + 1}`;
        return (
          <text key={d.date} x={xPos(i)} y={H - 9} textAnchor="middle" fontSize="9" fill="#9ca3af">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ── GscLivePanel ──────────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { key: Period; label: string; days: number }[] = [
  { key: "1m",     label: "28 ימים",    days: 28  },
  { key: "3m",     label: "3 חודשים",  days: 90  },
  { key: "6m",     label: "6 חודשים",  days: 180 },
  { key: "custom", label: "טווח מותאם", days: 0  },
];

function GscLivePanel({ clientId, hasProperties, onPeriodChange, refreshKey }: {
  clientId: string;
  hasProperties: boolean;
  onPeriodChange: (start: string, end: string) => void;
  refreshKey?: number;
}) {
  const [period, setPeriod] = useState<Period>("1m");
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [customEnd, setCustomEnd] = useState(() => {
    const d = new Date(); d.setDate(0);
    return d.toISOString().split("T")[0];
  });
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { startDate, endDate } = useMemo(() => {
    if (period === "custom") return { startDate: customStart, endDate: customEnd };
    const today = new Date();
    const end = today.toISOString().split("T")[0];
    const opt = PERIOD_OPTIONS.find(p => p.key === period)!;
    const s = new Date(today);
    s.setDate(s.getDate() - opt.days);
    return { startDate: s.toISOString().split("T")[0], endDate: end };
  }, [period, customStart, customEnd]);

  useEffect(() => {
    onPeriodChange(startDate, endDate);
    if (!hasProperties) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`/api/clients/${clientId}/gsc-live?startDate=${startDate}&endDate=${endDate}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(e => {
        if (!cancelled) { setError(e.message); setLoading(false); }
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, clientId, hasProperties, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtBig = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return n.toLocaleString("he-IL");
  };

  const kpis = [
    { label: 'סה"כ קליקים', value: data ? fmtBig(data.clicks) : "—", color: "#1E6FBF", bg: "#E8F4FF", border: "#bfdbfe" },
    { label: 'סה"כ הופעות', value: data ? fmtBig(data.impressions) : "—", color: "#7C3AED", bg: "#F5F3FF", border: "#ddd6fe" },
    { label: "CTR ממוצע",   value: data ? (data.ctr * 100).toFixed(2) + "%" : "—",   color: "#059669", bg: "#ECFDF5", border: "#a7f3d0" },
    { label: "מיקום ממוצע", value: data ? data.position.toFixed(1) : "—",             color: "#D97706", bg: "#FFFBEB", border: "#fde68a" },
  ];

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      {/* Header: title + period buttons */}
      <div style={{
        padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid var(--border-subtle)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>ביצועי חיפוש אורגני</div>
          {!hasProperties && (
            <span style={{ fontSize: 11, color: "var(--text-faint)", padding: "2px 8px", background: "var(--surface-sunken)", borderRadius: "var(--r-pill)", border: "1px solid var(--border)" }}>
              לא מחובר ל-GSC
            </span>
          )}
          {loading && <Loader2 size={13} className="animate-spin" style={{ color: "var(--text-faint)" }} />}
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {PERIOD_OPTIONS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                height: 30, paddingInline: "12px", fontSize: 12,
                fontFamily: "inherit", fontWeight: period === p.key ? 600 : 400,
                border: `1.5px solid ${period === p.key ? "var(--brand-navy)" : "var(--border)"}`,
                borderRadius: "var(--r-pill)",
                background: period === p.key ? "var(--brand-navy)" : "transparent",
                color: period === p.key ? "white" : "var(--text-soft)",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {period === p.key ? "✓ " : ""}{p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date inputs */}
      {period === "custom" && (
        <div style={{
          padding: "10px 20px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 12.5, color: "var(--text-soft)" }}>טווח תאריכים:</span>
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={dateInputStyle} />
          <span style={{ color: "var(--text-faint)" }}>—</span>
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={dateInputStyle} />
        </div>
      )}

      {/* KPI cards */}
      <div style={{ padding: "16px 20px 0", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {kpis.map(k => (
          <div key={k.label} style={{
            padding: "12px 16px",
            background: loading || !data ? "var(--surface-sunken)" : k.bg + "88",
            borderRadius: "var(--r-md)",
            border: `1.5px solid ${loading || !data ? "var(--border)" : k.border}`,
            transition: "all 0.2s",
          }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 4 }}>{k.label}</div>
            <div style={{
              fontSize: 26, fontWeight: 800, lineHeight: 1.1,
              color: loading || !data ? "var(--text-faint)" : k.color,
              fontVariantNumeric: "tabular-nums",
            }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ padding: "14px 20px 16px" }}>
        {/* Legend */}
        <div style={{ display: "flex", gap: 18, marginBottom: 8, fontSize: 11, color: "var(--text-soft)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 14, height: 3, background: "#1E6FBF", borderRadius: 2, display: "inline-block" }} />
            סה&quot;כ קליקים
            {data && !loading && (
              <strong style={{ color: "#1E6FBF", marginInlineStart: 2 }}>{fmtBig(data.clicks)}</strong>
            )}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 14, height: 3, background: "#7C3AED", borderRadius: 2, display: "inline-block" }} />
            סה&quot;כ הופעות
            {data && !loading && (
              <strong style={{ color: "#7C3AED", marginInlineStart: 2 }}>{fmtBig(data.impressions)}</strong>
            )}
          </span>
        </div>

        <DualLineChart trendData={data?.trendData ?? []} loading={loading} />

        {/* GA4 stats row — shown only when GA4 data available */}
        {data?.ga4 && !loading && (
          <div style={{
            marginTop: 16, paddingTop: 14,
            borderTop: "1px solid var(--border-subtle)",
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0,
          }}>
            {[
              { label: "סשנים אורגניים",          value: fmtBig(data.ga4.sessions),                   color: "#0369A1", icon: "📈", dim: false },
              { label: "הכנסות",                   value: "₪" + fmtBig(data.ga4.revenue ?? 0),         color: "#16a34a", icon: "💰", dim: false },
              { label: "סשנים — תקופה קודמת",     value: fmtBig(data.ga4.prevSessions ?? 0),           color: "#6b7280", icon: "📈", dim: true  },
              { label: "הכנסות — תקופה קודמת",    value: "₪" + fmtBig(data.ga4.prevRevenue ?? 0),      color: "#6b7280", icon: "💰", dim: true  },
            ].map((s, i, arr) => (
              <div key={s.label} style={{
                padding: "10px 14px",
                borderInlineEnd: i < arr.length - 1 ? "1px solid var(--border-subtle)" : "none",
                background: s.dim ? "var(--surface-subtle, #fafafa)" : undefined,
              }}>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 3 }}>
                  <span style={{ marginInlineEnd: 4 }}>{s.icon}</span>{s.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontVariantNumeric: "tabular-nums" }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* GA4 not connected notice */}
        {!data?.ga4 && data && !loading && (
          <div style={{
            marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border-subtle)",
            fontSize: 11.5, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--border-strong)", display: "inline-block", flexShrink: 0 }} />
            נתוני Google Analytics 4 אינם זמינים עבור לקוח זה
          </div>
        )}
      </div>

      {error && !loading && (
        <div style={{ padding: "0 20px 12px", fontSize: 12, color: "var(--red)", display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={13} /> {error}
        </div>
      )}
    </div>
  );
}

// ── ReportConfigPanel ─────────────────────────────────────────────────────────

function ReportConfigPanel({ clientId }: { clientId: string }) {
  const [cfg, setCfg] = useState<ReportConfig>(DEFAULT_REPORT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/report-config`)
      .then(r => r.json())
      .then(d => { setCfg(parseReportConfig(d.config)); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [clientId]);

  async function toggle(key: keyof ReportConfig) {
    const next = { ...cfg, [key]: !cfg[key] };
    setCfg(next);
    setSaving(true);
    try {
      await fetch(`/api/clients/${clientId}/report-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: next }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 className="card-title">הגדרות דוח — נתונים להצגה</h3>
        {saving && <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>שומר...</span>}
      </div>

      {!loaded ? (
        <div style={{ padding: "16px 20px", color: "var(--text-faint)", fontSize: 13 }}>טוען...</div>
      ) : (
        <div style={{ padding: "12px 20px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "16px 24px" }}>
          {REPORT_SECTIONS.map(section => (
            <div key={section.group}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>
                {section.group}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {section.items.map(item => (
                  <label
                    key={item.id}
                    style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
                  >
                    <input
                      type="checkbox"
                      checked={cfg[item.id]}
                      onChange={() => toggle(item.id)}
                      style={{ width: 14, height: 14, cursor: "pointer", accentColor: "#1E2D7D", flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 12.5, color: cfg[item.id] ? "var(--text)" : "var(--text-muted)" }}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── KeywordsPanel ─────────────────────────────────────────────────────────────

type Keyword = { query: string; clicks: number; impressions: number; ctr: number; position: number };

function PosBar({ pos }: { pos: number }) {
  const color = pos <= 3 ? "var(--green)" : pos <= 10 ? "var(--accent)" : pos <= 20 ? "var(--amber)" : "var(--text-faint)";
  const w = Math.max(4, Math.min(100, Math.round(100 - (pos / 100) * 88)));
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ fontWeight: 700, color, fontSize: 12, minWidth: 30 }}>{pos.toFixed(1)}</span>
      <span style={{ display: "inline-block", width: 36, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
        <span style={{ display: "block", width: `${w}%`, height: "100%", background: color, borderRadius: 2 }} />
      </span>
    </span>
  );
}

// ── GBP Live Panel ────────────────────────────────────────────────────────────

interface GbpData {
  title?: string;
  rating?: number;
  reviewCount?: number;
  searchImpressions: number;
  mapsImpressions: number;
  websiteClicks: number;
  callClicks: number;
  directionRequests: number;
}

function GbpLivePanel({ clientId, locationName, activePeriod, refreshKey }: {
  clientId: string;
  locationName: string;
  activePeriod: { startDate: string; endDate: string };
  refreshKey?: number;
}) {
  const [data, setData] = useState<GbpData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/clients/${clientId}/gbp-live?startDate=${activePeriod.startDate}&endDate=${activePeriod.endDate}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) { setError("שגיאה בטעינת נתוני GBP"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [clientId, activePeriod.startDate, activePeriod.endDate, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = [
    { label: "חיפוש Google",  val: data?.searchImpressions,   color: "#1E6FBF" },
    { label: "Google Maps",   val: data?.mapsImpressions,     color: "#2E7D32" },
    { label: "לחיצות לאתר",  val: data?.websiteClicks,       color: "#7C3AED" },
    { label: "שיחות",        val: data?.callClicks,          color: "#D97706" },
    { label: "ניווטים",      val: data?.directionRequests,   color: "#DC2626" },
  ];

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3 className="card-title">Google Business Profile</h3>
          <p className="card-sub">{data?.title ?? locationName.split("/").pop()}</p>
        </div>
        {loading && <Loader2 size={13} className="animate-spin" style={{ color: "var(--text-faint)" }} />}
      </div>

      {error && (
        <div style={{ padding: "10px 20px", fontSize: 12.5, color: "var(--red)", display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={13} /> {error}
        </div>
      )}

      {/* Rating */}
      {(data?.rating || data?.reviewCount) && (
        <div style={{ padding: "10px 20px 0", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#D97706", lineHeight: 1 }}>
            {data.rating?.toFixed(1) ?? "—"}
          </div>
          <div>
            <div style={{ display: "flex", gap: 2 }}>
              {[1,2,3,4,5].map(s => (
                <span key={s} style={{ color: s <= Math.round(data.rating ?? 0) ? "#D97706" : "var(--border-strong)", fontSize: 13 }}>★</span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 1 }}>
              {(data.reviewCount ?? 0).toLocaleString()} ביקורות
            </div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ padding: "14px 20px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {stats.map(s => (
          <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: loading ? "var(--text-faint)" : s.color, fontVariantNumeric: "tabular-nums" }}>
              {loading ? "—" : (s.val ?? 0).toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Keywords Panel ────────────────────────────────────────────────────────────

function KeywordsPanel({ clientId, hasProperties, brandKeywords, activePeriod, onBrandKeywordsChange }: {
  clientId: string;
  hasProperties: boolean;
  brandKeywords: string[];
  activePeriod: { startDate: string; endDate: string };
  onBrandKeywordsChange: (next: string[]) => void;
}) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showBrand, setShowBrand] = useState(false);
  const [newExclusion, setNewExclusion] = useState("");

  // Report keywords state
  const [reportKws, setReportKws] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [gscRes, rkRes] = await Promise.all([
        fetch(`/api/clients/${clientId}/keywords?startDate=${activePeriod.startDate}&endDate=${activePeriod.endDate}`),
        fetch(`/api/clients/${clientId}/report-keywords`),
      ]);
      const gscData = await gscRes.json();
      const rkData  = await rkRes.json();
      if (!gscRes.ok) throw new Error(gscData.error);
      setKeywords(gscData.keywords);
      setReportKws(new Set(rkData.keywords ?? []));
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  }

  async function saveReportKws(next: Set<string>) {
    setSaving(true);
    try {
      await fetch(`/api/clients/${clientId}/report-keywords`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: [...next] }),
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleReportKw(kw: string) {
    const next = new Set(reportKws);
    if (next.has(kw)) next.delete(kw); else next.add(kw);
    setReportKws(next);
    saveReportKws(next);
  }

  function addBulkKeywords() {
    const lines = bulkInput.split(/[\n,]/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const next = new Set([...reportKws, ...lines]);
    setReportKws(next);
    saveReportKws(next);
    setBulkInput("");
    setShowManualInput(false);
  }

  function removeReportKw(kw: string) {
    const next = new Set(reportKws);
    next.delete(kw);
    setReportKws(next);
    saveReportKws(next);
  }

  useEffect(() => {
    load();
  }, [activePeriod.startDate, activePeriod.endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const isBrand = (query: string) =>
    brandKeywords.some(kw => {
      try { return new RegExp(kw, "i").test(query); }
      catch { return query.toLowerCase().includes(kw.toLowerCase()); }
    });

  const visible = keywords
    .filter(k => showBrand || !isBrand(k.query))
    .filter(k => !search || k.query.toLowerCase().includes(search.toLowerCase()));

  // Keywords in report list that don't appear in GSC results
  const manualOnlyKws = [...reportKws].filter(kw => !keywords.some(k => k.query === kw));

  if (!hasProperties) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h3 className="card-title">ביטויי מפתח</h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {loaded && (
            <>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="חיפוש ביטוי..."
                style={{
                  height: 30, paddingInline: "10px 8px", width: 160,
                  border: "1px solid var(--border)", borderRadius: "var(--r-sm)",
                  background: "var(--surface)", fontSize: 12.5,
                  fontFamily: "inherit", color: "var(--text)", outline: "none",
                }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--text-muted)", cursor: "pointer", userSelect: "none" }}>
                <input type="checkbox" checked={showBrand} onChange={e => setShowBrand(e.target.checked)} />
                כולל מותג
              </label>
            </>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="btn btn-secondary sm"
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            רענן
          </button>
        </div>
      </div>

      {/* ── Report keywords list ──────────────────────────────────────── */}
      <div style={{
        padding: "10px 20px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-sunken)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: reportKws.size > 0 || showManualInput ? 8 : 0 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
            ביטויים לדוח
            {saving && <span style={{ marginInlineStart: 6, color: "var(--text-faint)", fontWeight: 400 }}>שומר...</span>}
            {reportKws.size > 0 && <span style={{ marginInlineStart: 6, color: "var(--text-faint)", fontWeight: 400 }}>({reportKws.size})</span>}
          </span>
          <button
            onClick={() => setShowManualInput(v => !v)}
            className="btn btn-primary accent sm"
            style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 4 }}
          >
            <Plus size={11} /> הוסף ידנית
          </button>
        </div>

        {/* Manual input */}
        {showManualInput && (
          <div style={{ marginBottom: 8 }}>
            <textarea
              value={bulkInput}
              onChange={e => setBulkInput(e.target.value)}
              placeholder={"הכנס ביטויים — שורה אחת לכל ביטוי או מופרדים בפסיק"}
              rows={4}
              style={{
                width: "100%", padding: "8px 10px", fontSize: 12.5,
                border: "1px solid var(--border)", borderRadius: "var(--r-sm)",
                background: "var(--surface)", fontFamily: "inherit",
                color: "var(--text)", resize: "vertical", outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <button onClick={addBulkKeywords} className="btn btn-primary sm" style={{ fontSize: 12 }}>
                הוסף לרשימה
              </button>
              <button onClick={() => { setShowManualInput(false); setBulkInput(""); }} className="btn btn-ghost sm" style={{ fontSize: 12 }}>
                ביטול
              </button>
            </div>
          </div>
        )}

        {/* Chips — report keywords */}
        {reportKws.size > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {[...reportKws].sort().map(kw => {
              const inGsc = keywords.some(k => k.query === kw);
              return (
                <span
                  key={kw}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: inGsc ? "#eff6ff" : "var(--surface)",
                    border: `1px solid ${inGsc ? "#bfdbfe" : "var(--border)"}`,
                    borderRadius: "var(--r-pill)", padding: "2px 8px",
                    fontSize: 12, color: inGsc ? "#1d4ed8" : "var(--text-soft)",
                  }}
                >
                  {kw}
                  <button
                    onClick={() => removeReportKw(kw)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", padding: 0, display: "flex", lineHeight: 1 }}
                  >
                    <X size={11} />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {reportKws.size === 0 && !showManualInput && (
          <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
            סמן ביטויים מהטבלה או הוסף ידנית — הם יופיעו בדוח.
          </div>
        )}
      </div>

      {/* ── Brand exclusion bar ───────────────────────────────────────── */}
      <div style={{
        padding: "8px 20px",
        borderBottom: "1px solid var(--border)",
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6,
        background: "var(--surface-sunken)",
      }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0, fontWeight: 500 }}>
          החרגת מותג:
        </span>
        {brandKeywords.map(kw => (
          <span
            key={kw}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-pill)", padding: "2px 8px",
              fontSize: 12, color: "var(--text-soft)",
            }}
          >
            {kw}
            <button
              onClick={() => onBrandKeywordsChange(brandKeywords.filter(b => b !== kw))}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", padding: 0, display: "flex", lineHeight: 1 }}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            value={newExclusion}
            onChange={e => setNewExclusion(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                const v = newExclusion.trim();
                if (v && !brandKeywords.includes(v)) onBrandKeywordsChange([...brandKeywords, v]);
                setNewExclusion("");
              }
            }}
            placeholder="הוסף דפוס (Regex)..."
            style={{
              height: 26, paddingInline: "8px", width: 160,
              border: "1px dashed var(--border-strong)", borderRadius: "var(--r-pill)",
              background: "transparent", fontSize: 12, fontFamily: "inherit",
              outline: "none", color: "var(--text)",
            }}
          />
          <button
            onClick={() => {
              const v = newExclusion.trim();
              if (v && !brandKeywords.includes(v)) onBrandKeywordsChange([...brandKeywords, v]);
              setNewExclusion("");
            }}
            className="btn btn-ghost sm"
            style={{ padding: "2px 8px", fontSize: 12 }}
          >
            <Plus size={11} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 20px", fontSize: 12.5, color: "var(--red)", display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={13} /> {error}
        </div>
      )}

      {loading && (
        <div style={{ padding: "20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
          <Loader2 size={14} className="animate-spin" /> טוען נתוני ביטויים...
        </div>
      )}

      {loaded && !loading && (
        <>
          <div style={{ padding: "6px 20px 10px", fontSize: 12, color: "var(--text-faint)" }}>
            מציג {visible.length} ביטויים מ-GSC
            {brandKeywords.length > 0 && !showBrand && ` (ביטויי מותג מוסתרים)`}
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: "center" }}>לדוח</th>
                  <th>ביטוי</th>
                  <th className="hidden-mobile" style={{ textAlign: "left" }}>קליקים</th>
                  <th className="hidden-mobile" style={{ textAlign: "left" }}>חשיפות</th>
                  <th className="hidden-mobile" style={{ textAlign: "left" }}>CTR</th>
                  <th style={{ textAlign: "left" }}>מיקום</th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, 100).map((k, i) => {
                  const checked = reportKws.has(k.query);
                  return (
                    <tr
                      key={k.query}
                      style={{ background: checked ? "#f0f9ff" : i % 2 === 0 ? "transparent" : "var(--surface-sunken)", cursor: "pointer" }}
                      onClick={() => toggleReportKw(k.query)}
                    >
                      <td style={{ textAlign: "center", paddingBlock: 0 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleReportKw(k.query)}
                          onClick={e => e.stopPropagation()}
                          style={{ cursor: "pointer", accentColor: "#1d4ed8" }}
                        />
                      </td>
                      <td style={{ fontSize: 13, fontWeight: checked ? 600 : 500, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {k.query}
                        {isBrand(k.query) && (
                          <span style={{ marginInlineStart: 6, fontSize: 10, color: "var(--accent)", background: "var(--accent-soft)", padding: "1px 5px", borderRadius: 10 }}>מותג</span>
                        )}
                      </td>
                      <td className="hidden-mobile" style={{ fontWeight: 600, fontSize: 13, fontVariantNumeric: "tabular-nums", textAlign: "left" }}>
                        {k.clicks.toLocaleString("he-IL")}
                      </td>
                      <td className="hidden-mobile" style={{ color: "var(--text-muted)", fontSize: 12.5, textAlign: "left" }}>
                        {k.impressions.toLocaleString("he-IL")}
                      </td>
                      <td className="hidden-mobile" style={{ color: "var(--text-muted)", fontSize: 12.5, textAlign: "left" }}>
                        {(k.ctr * 100).toFixed(2)}%
                      </td>
                      <td style={{ textAlign: "left" }}>
                        <PosBar pos={k.position} />
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "var(--text-faint)", padding: "20px" }}>
                      {search ? `לא נמצאו ביטויים עבור "${search}"` : "אין ביטויים"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Manual-only keywords (added manually, not in GSC) */}
          {manualOnlyKws.length > 0 && (
            <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border)", background: "var(--surface-sunken)" }}>
              <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 6 }}>
                ביטויים שהוספו ידנית ואינם מופיעים ב-GSC לתקופה זו:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {manualOnlyKws.sort().map(kw => (
                  <span
                    key={kw}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: "var(--surface)", border: "1px solid var(--border)",
                      borderRadius: "var(--r-pill)", padding: "2px 8px",
                      fontSize: 12, color: "var(--text-soft)",
                    }}
                  >
                    {kw}
                    <button
                      onClick={() => removeReportKw(kw)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", padding: 0, display: "flex", lineHeight: 1 }}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── style constants ───────────────────────────────────────────────────────────

const integCardStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "10px 12px", borderRadius: "var(--r-md)",
  border: "1px solid var(--border)", background: "var(--surface)",
};

const settingsRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
};

const dateInputStyle: React.CSSProperties = {
  height: 32, paddingInline: "10px",
  border: "1px solid var(--border)", borderRadius: "var(--r-sm)",
  background: "var(--surface)", fontSize: 13,
  fontFamily: "inherit", outline: "none", color: "var(--text)",
};

const settingsLabelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 500, color: "var(--text-soft)",
};
