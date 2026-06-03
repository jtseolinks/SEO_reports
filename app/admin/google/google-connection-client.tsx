"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2, AlertCircle, RefreshCw, Loader2, X, Sparkles, ChevronLeft,
} from "lucide-react";

// ── types ─────────────────────────────────────────────────────────────────────

type ConnectionData = {
  id: string;
  googleEmail: string | null;
  status: string;
  lastError: string | null;
  updatedAt: string;
  createdAt: string;
};

type Stats = {
  monitored: number;
  ga4Count: number;
  gscCount: number;
  emailsSentThisMonth: number;
};

type Props = {
  connection: ConnectionData | null;
  stats: Stats;
  sendgridConnected: boolean;
  successMessage?: string;
  errorMessage?: string;
};

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtLastSync(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return `היום ב-${d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return fmtDate(iso);
}

// Google G multicolor logo
function GoogleLogo({ size = 48 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

// Permission pill
function PermissionPill({ label }: { label: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      border: "1px solid var(--border)", borderRadius: 20,
      padding: "3px 10px", fontSize: 12, color: "var(--text-muted)",
      background: "var(--surface)",
    }}>
      {label}
      <CheckCircle2 size={11} style={{ color: "var(--green)", flexShrink: 0 }} />
    </span>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function GoogleConnectionClient({
  connection, stats, sendgridConnected, successMessage, errorMessage,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [unmonitored, setUnmonitored] = useState<number | null>(null);

  const isConnected = connection?.status === "CONNECTED";
  const needsReauth = connection?.status === "REQUIRES_REAUTH";
  const hasError = connection?.status === "ERROR";

  // Fetch unmonitored count (GSC sites in Google not yet in our DB)
  useEffect(() => {
    if (!isConnected) return;
    fetch("/api/google/gsc-sites")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.sites) return;
        const total: number = data.sites.length;
        setUnmonitored(Math.max(0, total - stats.gscCount));
      })
      .catch(() => {});
  }, [isConnected, stats.gscCount]);

  async function handleDisconnect() {
    if (!confirm("לנתק את חשבון Google? כל הסנכרונים יעצרו עד שתתחבר מחדש.")) return;
    setDisconnecting(true);
    try {
      await fetch("/api/auth/google/disconnect", { method: "POST" });
      startTransition(() => router.refresh());
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    await new Promise(r => setTimeout(r, 600)); // brief visual feedback
    startTransition(() => router.refresh());
    setSyncing(false);
  }

  const statCols = [
    { tag: "#R",  tagBg: "#EEF0F9", tagColor: "#1E2D7D", label: "מנוטרים במערכת",         value: stats.monitored },
    { tag: "GBP", tagBg: "#FDF3E1", tagColor: "#B45309", label: "פרופילי Business Profile", value: "—" },
    { tag: "GA4", tagBg: "#E6F4EA", tagColor: "#15803D", label: "נכסי Analytics 4",         value: stats.ga4Count },
    { tag: "GSC", tagBg: "#E0F4FF", tagColor: "#0369A1", label: "נכסי Search Console",      value: stats.gscCount },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Toast messages */}
      {successMessage && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: "var(--r-md)", border: "1px solid var(--green-soft-strong)", background: "var(--green-soft)", padding: "10px 14px", fontSize: 13, color: "var(--green)" }}>
          <CheckCircle2 size={15} />{successMessage}
        </div>
      )}
      {errorMessage && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: "var(--r-md)", border: "1px solid var(--red-soft-strong)", background: "var(--red-soft)", padding: "10px 14px", fontSize: 13, color: "var(--red)" }}>
          <AlertCircle size={15} />{errorMessage}
        </div>
      )}

      {/* ── Google account card ─────────────────────────────────────────────── */}
      <div className="card" style={{ overflow: "hidden" }}>

        {/* Main info row */}
        <div style={{ padding: "20px 24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>

          {/* Right: logo + info */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <GoogleLogo size={48} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>חשבון Google של הסוכנות</span>
                {connection && (
                  <span className={`rk-badge ${isConnected ? "success" : (needsReauth || hasError) ? "danger" : "neutral"}`}>
                    <span className="pip" />
                    {isConnected ? "מחובר" : needsReauth ? "נדרש חיבור מחדש" : hasError ? "שגיאה" : "לא מחובר"}
                  </span>
                )}
              </div>

              {connection ? (
                <>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
                    {connection.googleEmail && (
                      <span style={{ fontWeight: 500, color: "var(--text)" }}>{connection.googleEmail}</span>
                    )}
                    {connection.googleEmail && " · "}
                    {`מחובר מאז ${fmtDate(connection.createdAt)}`}
                    {" · "}
                    {`סנכרון אחרון: ${fmtLastSync(connection.updatedAt)}`}
                  </div>
                  {isConnected && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      <PermissionPill label="Business Profile (Read)" />
                      <PermissionPill label="Analytics (Read)" />
                      <PermissionPill label="Search Console (Read)" />
                    </div>
                  )}
                  {(needsReauth || hasError) && connection.lastError && (
                    <div style={{ marginTop: 10, borderRadius: "var(--r-sm)", border: "1px solid var(--amber-soft-strong)", background: "var(--amber-soft)", padding: "8px 12px", fontSize: 12, color: "var(--amber)" }}>
                      {connection.lastError}
                    </div>
                  )}
                </>
              ) : (
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                  חבר את חשבון Google של הסוכנות כדי לאפשר שליפת נתונים עבור כל הלקוחות.
                </p>
              )}
            </div>
          </div>

          {/* Left: action buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, alignItems: "flex-start" }}>
            {isConnected ? (
              <>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="btn btn-secondary"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
                >
                  {syncing
                    ? <Loader2 size={13} className="animate-spin" />
                    : <RefreshCw size={13} />}
                  סנכרן עכשיו
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--red)", fontSize: 13, fontWeight: 500,
                    padding: "4px 0",
                  }}
                >
                  {disconnecting
                    ? <Loader2 size={13} className="animate-spin" />
                    : <X size={13} />}
                  נתק חשבון
                </button>
              </>
            ) : (
              <a
                href="/api/auth/google"
                className="btn btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
              >
                <RefreshCw size={13} />
                {needsReauth || hasError ? "התחבר מחדש ל-Google" : "חבר Google"}
              </a>
            )}
          </div>
        </div>

        {/* Stats grid */}
        {isConnected && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderTop: "1.5px solid var(--border-subtle)" }}>
            {statCols.map((col, i) => (
              <div
                key={col.tag}
                style={{
                  padding: "16px 20px",
                  borderInlineEnd: i < 3 ? "1px solid var(--border-subtle)" : undefined,
                  textAlign: "right",
                }}
              >
                <span style={{
                  display: "inline-block", fontSize: 10, fontWeight: 800,
                  padding: "2px 7px", borderRadius: 4,
                  background: col.tagBg, color: col.tagColor,
                  letterSpacing: "0.02em",
                }}>
                  {col.tag}
                </span>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>{col.label}</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: "var(--text)", lineHeight: 1.1, marginTop: 2 }}>
                  {col.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer CTA */}
        {isConnected && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 24px",
            background: "var(--surface-hover)",
            borderTop: "1px solid var(--border-subtle)",
          }}>
            {unmonitored !== null && unmonitored > 0 ? (
              <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--text-muted)" }}>
                <Sparkles size={13} style={{ color: "var(--accent)" }} />
                זיהינו {unmonitored} נכסים נוספים בחשבון שלך שאינם מנוטרים עדיין
              </span>
            ) : (
              <span />
            )}
            <Link
              href="/admin/clients/import-gsc"
              className="btn btn-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
            >
              <ChevronLeft size={14} /> עיין וייבא
            </Link>
          </div>
        )}
      </div>

      {/* ── שירותים נוספים ─────────────────────────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 14, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          שירותים נוספים
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>

          {/* Google Drive */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                  background: "#f1f3f4", display: "grid", placeItems: "center",
                  fontSize: 13, fontWeight: 700, color: "#5f6368",
                }}>
                  GD
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", marginBottom: 4 }}>Google Drive</div>
                  <span className="rk-badge warn" style={{ fontSize: 11 }}>
                    <span className="pip" />לא מחובר
                  </span>
                </div>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
              אחסון אוטומטי של דוחות PDF בתיקיית לקוח ייעודית
            </p>
            <button className="btn btn-primary" style={{ fontSize: 13 }}>
              חבר
            </button>
          </div>

          {/* SendGrid */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                  background: "#EBF8FA", display: "grid", placeItems: "center",
                  fontSize: 13, fontWeight: 700, color: "#1A82A2",
                }}>
                  SG
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", marginBottom: 4 }}>SendGrid</div>
                  <span className={`rk-badge ${sendgridConnected ? "success" : "warn"}`} style={{ fontSize: 11 }}>
                    <span className="pip" />{sendgridConnected ? "מחובר" : "לא מחובר"}
                  </span>
                </div>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
              שליחת דוחות במייל ובניית תבניות אישיות ללקוח
            </p>
            {sendgridConnected ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  מחובר · {stats.emailsSentThisMonth} שליחות החודש
                </span>
                <button className="btn btn-secondary" style={{ fontSize: 13 }}>נהל</button>
              </div>
            ) : (
              <button className="btn btn-primary" style={{ fontSize: 13 }}>חבר</button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
