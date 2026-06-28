"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2, CheckCircle2, AlertTriangle, Play, FileText } from "lucide-react";

type ClientItem = {
  id: string;
  name: string;
  domain: string;
  googleProperties: { gscSiteUrl: string | null } | null;
};

type GenStatus = "idle" | "running" | "success" | "failed";
type ClientResult = { status: GenStatus; error?: string };

function defaultMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function BulkGenerateModal({ onClose }: { onClose: () => void }) {
  const [month, setMonth] = useState(defaultMonth());
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<Record<string, ClientResult>>({});
  const [currentId, setCurrentId] = useState<string | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    fetch("/api/clients")
      .then(r => r.json())
      .then((data: ClientItem[]) => {
        const eligible = data.filter(c => c.googleProperties?.gscSiteUrl);
        setClients(eligible);
        setSelected(new Set(eligible.map(c => c.id)));
        setLoading(false);
      });
  }, []);

  const allChecked = clients.length > 0 && clients.every(c => selected.has(c.id));
  const someChecked = selected.size > 0 && !allChecked;

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(clients.map(c => c.id)));
  }
  function toggleOne(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function generate() {
    const ids = [...selected];
    setRunning(true);
    setDone(false);
    abortRef.current = false;
    const res: Record<string, ClientResult> = {};

    for (const id of ids) {
      if (abortRef.current) break;
      setCurrentId(id);
      res[id] = { status: "running" };
      setResults({ ...res });

      try {
        const r = await fetch("/api/reports/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: id, reportMonth: month }),
        });
        const body = await r.json();
        res[id] = r.ok ? { status: "success" } : { status: "failed", error: body.error };
      } catch (e) {
        res[id] = { status: "failed", error: String(e) };
      }

      setResults({ ...res });
    }

    setCurrentId(null);
    setRunning(false);
    setDone(true);
  }

  function reset() {
    setDone(false);
    setResults({});
    setCurrentId(null);
  }

  const doneCount = Object.keys(results).length;
  const successCount = Object.values(results).filter(r => r.status === "success").length;
  const failedCount = Object.values(results).filter(r => r.status === "failed").length;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Backdrop */}
      <div
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
        onClick={!running ? onClose : undefined}
      />

      {/* Panel */}
      <div style={{
        position: "relative", background: "var(--surface)",
        borderRadius: "var(--r-lg)", width: 540,
        maxWidth: "calc(100vw - 32px)", maxHeight: "82vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 64px rgba(0,0,0,0.28)",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>צור דוחות לכלל הלקוחות</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>
              בחר חודש ולקוחות - הדוחות ייווצרו ברצף
            </div>
          </div>
          {!running && (
            <button onClick={onClose} className="iconbtn" style={{ marginTop: 2 }}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "18px 24px" }}>
          {/* Month picker */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>
              חודש הדוח
            </label>
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              disabled={running}
              style={{
                height: 34, paddingInline: 10,
                border: "1px solid var(--border)", borderRadius: "var(--r-sm)",
                background: "var(--surface)", fontSize: 13,
                fontFamily: "inherit", color: "var(--text)", outline: "none",
              }}
            />
          </div>

          {/* Client list */}
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 13, padding: "16px 0" }}>
              <Loader2 size={14} className="animate-spin" /> טוען לקוחות...
            </div>
          ) : clients.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-faint)", padding: "12px 0" }}>
              אין לקוחות עם נכסי Google מחוברים.
            </div>
          ) : (
            <>
              {/* Select all row */}
              <button
                onClick={toggleAll}
                disabled={running}
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-muted)", background: "none", border: "none", cursor: running ? "default" : "pointer", padding: "0 0 10px 0", width: "100%" }}
              >
                <span style={{
                  width: 15, height: 15, border: `1.5px solid ${allChecked || someChecked ? "var(--accent)" : "var(--border-strong)"}`,
                  borderRadius: 3, display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: allChecked ? "var(--accent)" : "transparent", flexShrink: 0,
                }}>
                  {allChecked && <span style={{ color: "white", fontSize: 10, lineHeight: 1 }}>✓</span>}
                  {someChecked && <span style={{ color: "var(--accent)", fontSize: 11, lineHeight: 1, fontWeight: 700 }}>−</span>}
                </span>
                בחר הכל <span style={{ color: "var(--text-faint)" }}>({clients.length} לקוחות עם Google מחובר)</span>
              </button>

              {/* Scrollable list */}
              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-sm)", overflow: "hidden", maxHeight: 300, overflowY: "auto" }}>
                {clients.map((c, i) => {
                  const res = results[c.id];
                  const isCurrent = currentId === c.id;
                  const isSelected = selected.has(c.id);
                  return (
                    <div
                      key={c.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "9px 12px",
                        borderBottom: i < clients.length - 1 ? "1px solid var(--border-subtle)" : "none",
                        background: isCurrent ? "var(--surface-hover)" : "transparent",
                        transition: "background 0.15s",
                      }}
                    >
                      <button
                        onClick={() => !running && toggleOne(c.id)}
                        disabled={running}
                        style={{
                          width: 15, height: 15, border: `1.5px solid ${isSelected ? "var(--accent)" : "var(--border-strong)"}`,
                          borderRadius: 3, display: "inline-flex", alignItems: "center", justifyContent: "center",
                          background: isSelected ? "var(--accent)" : "transparent",
                          flexShrink: 0, cursor: running ? "default" : "pointer",
                        }}
                      >
                        {isSelected && <span style={{ color: "white", fontSize: 10 }}>✓</span>}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{c.domain}</div>
                      </div>
                      <div style={{ flexShrink: 0, width: 20, display: "flex", justifyContent: "center" }}>
                        {isCurrent && <Loader2 size={14} className="animate-spin" style={{ color: "var(--accent)" }} />}
                        {!isCurrent && res?.status === "success" && <CheckCircle2 size={15} style={{ color: "var(--green)" }} />}
                        {!isCurrent && res?.status === "failed" && (
                          <span title={res.error} style={{ cursor: "help", display: "flex" }}>
                            <AlertTriangle size={15} style={{ color: "var(--red)" }} />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Progress bar */}
          {running && selected.size > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  background: "var(--accent)",
                  width: `${(doneCount / selected.size) * 100}%`,
                  transition: "width 0.3s",
                }} />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 5, textAlign: "center" }}>
                {doneCount} / {selected.size} דוחות
              </div>
            </div>
          )}

          {/* Done summary */}
          {done && (
            <div style={{
              marginTop: 14, padding: "10px 14px", borderRadius: "var(--r-sm)",
              background: failedCount === 0 ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${failedCount === 0 ? "#bbf7d0" : "#fecaca"}`,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: failedCount === 0 ? "#16a34a" : "#dc2626" }}>
                {failedCount === 0
                  ? `✓ ${successCount} דוחות נוצרו בהצלחה`
                  : `${successCount} הצליחו · ${failedCount} נכשלו - רחף על ⚠ לפרטים`}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px 20px", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
          {!running && <button onClick={onClose} className="btn btn-ghost">סגור</button>}
          {done && <button onClick={reset} className="btn btn-secondary">צור שוב</button>}
          {!done && (
            <button
              onClick={generate}
              disabled={running || selected.size === 0 || loading}
              className="btn btn-primary accent"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              {running ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  מייצר... ({doneCount}/{selected.size})
                </>
              ) : (
                <>
                  <Play size={13} fill="currentColor" />
                  צור {selected.size > 0 ? `${selected.size} ` : ""}דוחות
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Public button wrapper ─────────────────────────────────────────────────────

export function BulkGenerateButton({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={variant === "primary" ? "btn btn-primary accent" : "btn btn-secondary"}
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <FileText size={14} /> צור דוחות חדשיים
      </button>
      {open && <BulkGenerateModal onClose={() => setOpen(false)} />}
    </>
  );
}
