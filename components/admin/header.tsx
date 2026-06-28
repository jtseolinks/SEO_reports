"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, Search, AlertCircle, AlertTriangle, X, BellOff } from "lucide-react";
import { useState, useEffect, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Notification = {
  id: string;
  /** critical = always visible, only acknowledgeable (hides bell dot).
   *  warn     = dismissible forever via localStorage. */
  type: "critical" | "warn";
  title: string;
  body: string;
  href?: string;
};

// ── localStorage keys ─────────────────────────────────────────────────────────
const LS_DISMISSED = "rk_notif_dismissed";  // warn IDs permanently hidden
const LS_ACKED     = "rk_notif_acked";      // critical IDs: in panel but no bell dot

function readSet(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) ?? "[]")); }
  catch { return new Set(); }
}
function writeSet(key: string, set: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

// ── Breadcrumb labels ─────────────────────────────────────────────────────────

const PATH_LABELS: Record<string, string> = {
  "/admin":          "לוח בקרה",
  "/admin/clients":  "לקוחות",
  "/admin/reports":  "דוחות",
  "/admin/google":   "אינטגרציות",
  "/admin/settings": "הגדרות",
};

function getLabel(pathname: string): string {
  if (PATH_LABELS[pathname]) return PATH_LABELS[pathname];
  const match = Object.keys(PATH_LABELS)
    .filter((k) => k !== "/admin" && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PATH_LABELS[match] : "לוח בקרה";
}

// ── Topbar ────────────────────────────────────────────────────────────────────

export function Topbar() {
  const pathname = usePathname();
  const router   = useRouter();
  const label    = getLabel(pathname);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen]       = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [acked, setAcked]         = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  // Load persisted state from localStorage on mount
  useEffect(() => {
    setDismissed(readSet(LS_DISMISSED));
    setAcked(readSet(LS_ACKED));
  }, []);

  // Fetch notifications on route change
  useEffect(() => {
    fetch("/api/notifications")
      .then(r => r.json())
      .then(d => setNotifications(d.notifications ?? []))
      .catch(() => {/* silent */});
  }, [pathname]);

  // Close panel on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Derived state ────────────────────────────────────────────────────────────

  // warn: hidden if dismissed. critical: never hidden, always in panel.
  const visibleInPanel = notifications.filter(n =>
    n.type === "critical" || !dismissed.has(n.id)
  );

  // Bell dot: critical (not acked) OR any visible warn
  const bellCritical = notifications.filter(n => n.type === "critical" && !acked.has(n.id));
  const bellWarn     = notifications.filter(n => n.type === "warn" && !dismissed.has(n.id));
  const showDot      = bellCritical.length > 0 || bellWarn.length > 0;
  const dotColor     = bellCritical.length > 0 ? "var(--red)" : "var(--amber)";

  // ── Actions ──────────────────────────────────────────────────────────────────

  function dismissWarn(id: string) {
    const next = new Set([...dismissed, id]);
    setDismissed(next);
    writeSet(LS_DISMISSED, next);
  }

  function ackCritical(id: string) {
    const next = new Set([...acked, id]);
    setAcked(next);
    writeSet(LS_ACKED, next);
  }

  function clearAll() {
    // dismiss all warns + ack all criticals
    const newDismissed = new Set([...dismissed, ...notifications.filter(n => n.type === "warn").map(n => n.id)]);
    const newAcked     = new Set([...acked,     ...notifications.filter(n => n.type === "critical").map(n => n.id)]);
    setDismissed(newDismissed);
    setAcked(newAcked);
    writeSet(LS_DISMISSED, newDismissed);
    writeSet(LS_ACKED, newAcked);
  }

  const canClearAll = visibleInPanel.some(n =>
    (n.type === "warn" && !dismissed.has(n.id)) ||
    (n.type === "critical" && !acked.has(n.id))
  );

  return (
    <div className="topbar">
    <div className="topbar-inner">
      {/* Breadcrumb */}
      <div className="crumbs">
        <span>Rankey</span>
        <span className="sep">/</span>
        <span className="here">{label}</span>
      </div>

      {/* Search */}
      <div className="search-wrap">
        <Search size={14} className="search-icon" />
        <input placeholder="חיפוש לקוחות, דוחות, ביטויי מפתח..." />
      </div>

      {/* Bell */}
      <div style={{ position: "relative" }} ref={panelRef}>
        <button
          className="topbar-icon-btn"
          title="התראות"
          onClick={() => setOpen(o => !o)}
          style={{ color: showDot ? dotColor : undefined }}
        >
          <Bell size={17} />
          {showDot && <span className="notif-dot" style={{ background: dotColor }} />}
        </button>

        {/* Dropdown panel */}
        {open && (
          <div style={{
            position: "absolute",
            insetInlineEnd: 0,
            top: "calc(100% + 8px)",
            width: 360,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            zIndex: 200,
            overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                התראות
                {visibleInPanel.length > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", marginInlineStart: 5 }}>
                    ({visibleInPanel.length})
                  </span>
                )}
              </span>
              {canClearAll && (
                <button
                  onClick={clearAll}
                  style={{ fontSize: 12, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", cursor: "pointer", padding: "3px 8px" }}
                >
                  נקה הכל
                </button>
              )}
            </div>

            {/* Legend */}
            {visibleInPanel.length > 0 && (
              <div style={{ padding: "8px 16px 6px", display: "flex", gap: 14, borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 11, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 4 }}>
                  <AlertCircle size={11} style={{ color: "var(--red)" }} /> קריטי - תמיד מוצג
                </span>
                <span style={{ fontSize: 11, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 4 }}>
                  <AlertTriangle size={11} style={{ color: "var(--amber)" }} /> אזהרה - ניתן לסגירה
                </span>
              </div>
            )}

            {/* Items */}
            {visibleInPanel.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>
                ✓ אין התראות פעילות
              </div>
            ) : (
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                {visibleInPanel.map(n => {
                  const isCritical = n.type === "critical";
                  const isAcked = isCritical && acked.has(n.id);

                  return (
                    <div
                      key={n.id}
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid var(--border-subtle)",
                        display: "flex",
                        gap: 10,
                        opacity: isAcked ? 0.55 : 1,
                        cursor: n.href ? "pointer" : "default",
                        background: isCritical && !isAcked ? "rgba(220,38,38,0.03)" : "transparent",
                      }}
                      onClick={() => {
                        if (n.href) { router.push(n.href); setOpen(false); }
                      }}
                    >
                      {/* Icon */}
                      <div style={{ flexShrink: 0, marginTop: 1 }}>
                        {isCritical
                          ? <AlertCircle size={15} style={{ color: isAcked ? "var(--text-faint)" : "var(--red)" }} />
                          : <AlertTriangle size={15} style={{ color: "var(--amber)" }} />}
                      </div>

                      {/* Text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                          {n.body}
                        </div>
                      </div>

                      {/* Action button */}
                      <div style={{ flexShrink: 0, display: "flex", alignItems: "flex-start" }}>
                        {isCritical ? (
                          !isAcked ? (
                            <button
                              onClick={e => { e.stopPropagation(); ackCritical(n.id); }}
                              title="השתק התראה מהפעמון (ההתראה תישאר בפאנל)"
                              style={{
                                display: "flex", alignItems: "center", gap: 3,
                                fontSize: 11, color: "var(--text-muted)",
                                background: "none", border: "1px solid var(--border)",
                                borderRadius: "var(--r-sm)", cursor: "pointer", padding: "2px 6px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <BellOff size={10} /> השתק
                            </button>
                          ) : (
                            <span style={{ fontSize: 10, color: "var(--text-faint)", padding: "2px 4px" }}>
                              מושתק
                            </span>
                          )
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); dismissWarn(n.id); }}
                            title="סגור לצמיתות"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", padding: 0 }}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>{/* end topbar-inner */}
    </div>
  );
}

export { Topbar as Header };
