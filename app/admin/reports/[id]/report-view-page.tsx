"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Send, Download, RefreshCw, Loader2,
  AlertTriangle, FileText, Eye,
} from "lucide-react";

type Report = {
  id: string;
  reportMonth: string;
  status: string;
  pdfUrl: string | null;
  generatedAt: string | null;
  sentAt: string | null;
  errorMessage: string | null;
  gscClicks: number;
  gscImpressions: number;
  gscPosition: number;
  gscCtr: number;
  periodStart: string | null;
  periodEnd: string | null;
  openCount: number;
  client: {
    id: string;
    name: string;
    domain: string;
    contactEmail: string;
  };
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtMonth(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}
function fmtNum(n: number) {
  if (!n) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString("he-IL");
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    SENT:      { cls: "success", label: "נשלח" },
    GENERATED: { cls: "info",    label: "דוח מוכן" },
    DRAFT:     { cls: "warn",    label: "ממתין" },
    FAILED:    { cls: "danger",  label: "כשל" },
  };
  const m = map[status] ?? { cls: "neutral", label: status };
  return <span className={`rk-badge ${m.cls}`}><span className="pip" />{m.label}</span>;
}

export function ReportViewPage({ report }: { report: Report }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [sending, setSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const periodLabel = report.periodStart && report.periodEnd
    ? `${fmtDate(report.periodStart)} – ${fmtDate(report.periodEnd)}`
    : fmtMonth(report.reportMonth);

  async function sendReport() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/reports/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: report.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה בשליחה");
      setResult({ ok: true, msg: "הדוח נשלח בהצלחה ✓" });
      startTransition(() => router.refresh());
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : "שגיאה" });
    } finally {
      setSending(false);
    }
  }

  async function regenerate() {
    setRegenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: report.client.id, reportMonth: report.reportMonth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה ביצירה");
      setResult({ ok: true, msg: "הדוח נוצר מחדש בהצלחה" });
      startTransition(() => router.refresh());
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : "שגיאה" });
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="page">
      {/* Breadcrumb */}
      <div style={{ marginBottom: 14 }}>
        <Link
          href="/admin/reports"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-muted)", fontSize: 13, textDecoration: "none" }}
        >
          <ChevronLeft size={14} /> חזרה לדוחות
        </Link>
      </div>

      {/* Page header */}
      <div className="page-head" style={{ marginBottom: 16, alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title">תצוגה מקדימה של הדוח</h1>
          <p className="page-sub" style={{ marginTop: 4 }}>
            <Link
              href={`/admin/clients/${report.client.id}`}
              style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}
            >
              {report.client.name}
            </Link>
            {" · "}<span style={{ color: "var(--text-muted)" }}>{report.client.domain}</span>
            {report.sentAt && (
              <span style={{ color: "var(--text-faint)", fontSize: 12 }}> · {report.client.contactEmail}</span>
            )}
          </p>
        </div>
        <div className="page-head-actions">
          <button
            onClick={sendReport}
            disabled={sending}
            className="btn btn-primary accent"
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            שלח ללקוח
          </button>
          {report.pdfUrl && (
            <a href={report.pdfUrl} download className="btn btn-secondary">
              <Download size={13} /> הורד PDF
            </a>
          )}
          <button onClick={regenerate} disabled={regenerating} className="btn btn-secondary">
            {regenerating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            צור מחדש
          </button>
        </div>
      </div>

      {/* Metadata bar */}
      <div style={{
        display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
        marginBottom: 16, padding: "9px 16px",
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-md)", fontSize: 13, color: "var(--text-muted)",
      }}>
        <span style={{ fontWeight: 500, color: "var(--text-soft)" }}>A4</span>
        <span style={{ color: "var(--border-strong)" }}>·</span>
        <span>PDF</span>
        <span style={{ color: "var(--border-strong)" }}>·</span>
        <span>{periodLabel}</span>
        <span style={{ color: "var(--border-strong)" }}>·</span>
        <StatusBadge status={report.status} />
        {report.generatedAt && (
          <>
            <span style={{ color: "var(--border-strong)" }}>·</span>
            <span>נוצר {fmtDate(report.generatedAt)}</span>
          </>
        )}
        {report.sentAt && (
          <>
            <span style={{ color: "var(--border-strong)" }}>·</span>
            <span style={{ color: "var(--green)", fontWeight: 500 }}>נשלח {fmtDate(report.sentAt)}</span>
          </>
        )}
        {report.openCount > 0 && (
          <>
            <span style={{ color: "var(--border-strong)" }}>·</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Eye size={12} /> {report.openCount} פתיחות
            </span>
          </>
        )}
        {report.pdfUrl && (
          <a
            href={report.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 4, color: "var(--accent)", fontSize: 12, textDecoration: "none" }}
          >
            <Eye size={12} /> פתח בחלון חדש
          </a>
        )}
      </div>

      {/* Result message */}
      {result && (
        <div style={{
          marginBottom: 14, padding: "10px 14px",
          background: result.ok ? "var(--green-soft)" : "var(--red-soft)",
          border: `1px solid ${result.ok ? "var(--green-soft-strong)" : "var(--red-soft-strong)"}`,
          borderRadius: "var(--r-md)",
          color: result.ok ? "var(--green)" : "var(--red)", fontSize: 13,
        }}>
          {result.msg}
        </div>
      )}

      {/* KPI mini-row (when we have metrics) */}
      {(report.gscClicks > 0 || report.gscImpressions > 0) && (
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {[
            { label: "קליקים אורגניים", value: fmtNum(report.gscClicks) },
            { label: "חשיפות", value: fmtNum(report.gscImpressions) },
            { label: "פוזיציה ממוצעת", value: report.gscPosition > 0 ? report.gscPosition.toFixed(1) : "—" },
            { label: "CTR ממוצע", value: report.gscCtr > 0 ? (report.gscCtr * 100).toFixed(2) + "%" : "—" },
          ].map(k => (
            <div key={k.label} style={{
              flex: 1, padding: "14px 16px",
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
            }}>
              <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {report.status === "FAILED" && report.errorMessage && (
        <div className="card" style={{ marginBottom: 14, borderColor: "var(--red-soft-strong)" }}>
          <div className="card-pad" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <AlertTriangle size={16} style={{ color: "var(--red)", flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--red)", marginBottom: 4 }}>הדוח נכשל</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: "monospace" }}>{report.errorMessage}</div>
            </div>
          </div>
        </div>
      )}

      {/* PDF embed */}
      {report.pdfUrl ? (
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <iframe
            src={report.pdfUrl}
            style={{
              width: "100%",
              height: "calc(100vh - 280px)",
              minHeight: 560,
              border: "none",
              display: "block",
            }}
            title="תצוגה מקדימה של הדוח"
          />
        </div>
      ) : (
        <div className="card">
          <div className="card-pad" style={{ textAlign: "center", padding: "48px 20px" }}>
            <FileText size={40} style={{ color: "var(--text-faint)", margin: "0 auto 12px", display: "block" }} />
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
              {report.status === "FAILED" ? "הדוח נכשל" : "הדוח עדיין לא נוצר"}
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              לחץ על &quot;צור מחדש&quot; כדי ליצור את הדוח
            </p>
            <button onClick={regenerate} disabled={regenerating} className="btn btn-primary accent">
              {regenerating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {regenerating ? "יוצר..." : "צור מחדש"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
