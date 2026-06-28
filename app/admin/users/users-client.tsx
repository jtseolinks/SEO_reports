"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, RefreshCw, Loader2, X, Check, AlertCircle, CheckCircle2, Mail } from "lucide-react";

type SetupStatus = "complete" | "pending" | "expired" | "none";

type Member = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  setupStatus: SetupStatus;
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "בעלים",
  ADMIN: "מנהל",
  MEMBER: "חבר צוות",
};

const SETUP_BADGE: Record<SetupStatus, { label: string; bg: string; color: string; border: string }> = {
  complete: { label: "מוגדר ✓",    bg: "#dcfce7", color: "#15803d", border: "#bbf7d0" },
  pending:  { label: "ממתין ⏳",   bg: "#fef9c3", color: "#854d0e", border: "#fde68a" },
  expired:  { label: "פג תוקף ⚠", bg: "#fee2e2", color: "#991b1b", border: "#fecaca" },
  none:     { label: "לא נשלח",    bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" },
};

function SetupBadge({ status }: { status: SetupStatus }) {
  const s = SETUP_BADGE[status];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 5,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function Initials({ name, email }: { name: string | null; email: string }) {
  const src = name || email;
  const ini = src.split(/[\s@]/).map(p => p[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
      background: "var(--accent-soft)", display: "grid", placeItems: "center",
      fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>
      {ini}
    </div>
  );
}

type Props = { currentUserRole: string; currentUserId: string };

export function UsersClient({ currentUserRole, currentUserId }: Props) {
  const [members, setMembers]   = useState<Member[]>([]);
  const [loading, setLoading]   = useState(true);

  // Add form
  const [showAdd, setShowAdd]   = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole]   = useState("MEMBER");
  const [adding, setAdding]     = useState(false);
  const [addErr, setAddErr]     = useState("");
  const [addSetupUrl, setAddSetupUrl] = useState("");

  // Row state
  const [saving, setSaving]       = useState<string | null>(null);
  const [removing, setRemoving]   = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [resendOk, setResendOk]   = useState<Record<string, { ok: boolean; url?: string }>>({});
  const [rowErr, setRowErr]       = useState<string>("");

  // Derive role from loaded members (DB = source of truth; JWT can be stale after role change).
  const actualRole = members.find(m => m.id === currentUserId)?.role ?? currentUserRole;
  const isOwner = actualRole === "OWNER";
  const isAdmin = actualRole === "ADMIN" || isOwner;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/settings/users");
      const d = await r.json();
      setMembers(d.users ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setAddErr(""); setAddSetupUrl(""); setAdding(true);
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail, role: addRole }),
      });
      const data = await res.json();
      if (!res.ok) { setAddErr(data.error ?? "שגיאה"); return; }
      if (data.setupUrl) setAddSetupUrl(data.setupUrl);
      setAddEmail(""); setAddRole("MEMBER");
      await load();
    } finally { setAdding(false); }
  }

  async function changeRole(userId: string, newRole: string) {
    setSaving(userId); setRowErr("");
    const res = await fetch(`/api/settings/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    const data = await res.json();
    if (!res.ok) { setRowErr(data.error ?? "שגיאה"); }
    else { setMembers(prev => prev.map(m => m.id === userId ? { ...m, role: newRole } : m)); }
    setSaving(null);
  }

  async function removeMember(userId: string) {
    if (!confirm("להסיר את החבר מהצוות?")) return;
    setRemoving(userId); setRowErr("");
    const res = await fetch(`/api/settings/users/${userId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setRowErr(data.error ?? "שגיאה"); }
    else { setMembers(prev => prev.filter(m => m.id !== userId)); }
    setRemoving(null);
  }

  async function resendSetup(m: Member) {
    setResending(m.id);
    const res = await fetch(`/api/settings/users/${m.id}/resend-setup`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { alert(data.error ?? "שגיאה"); setResending(null); return; }
    setResendOk(prev => ({ ...prev, [m.id]: { ok: data.emailSent, url: data.setupUrl } }));
    await load();
    setResending(null);
  }

  // Can this user edit a given member?
  function canEditRole(m: Member) {
    if (m.id === currentUserId) return false; // can't edit self
    return isOwner; // only OWNER changes roles
  }

  function canRemove(m: Member) {
    if (m.id === currentUserId) return false;
    if (!isAdmin) return false;
    if (m.role === "OWNER" || m.role === "ADMIN") return isOwner;
    return true; // ADMIN can remove MEMBER
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {isAdmin && (
          <button
            onClick={() => setShowAdd(v => !v)}
            className="btn btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <UserPlus size={14} /> הוסף חבר צוות
          </button>
        )}
        <button onClick={load} className="btn btn-ghost"
          style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <RefreshCw size={13} /> רענן
        </button>
      </div>

      {/* Add member panel */}
      {showAdd && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", padding: "20px 24px" }}>
          <p style={{ margin: "0 0 14px", fontWeight: 700, fontSize: 14 }}>הוסף חבר צוות חדש</p>
          <form onSubmit={addMember} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
              <div className="field">
                <label className="field-label">אימייל *</label>
                <input className="rk-input" type="email" required dir="ltr"
                  value={addEmail} onChange={e => setAddEmail(e.target.value)}
                  placeholder="user@example.com" />
              </div>
              <div className="field">
                <label className="field-label">הרשאה</label>
                <select className="rk-input" value={addRole}
                  onChange={e => setAddRole(e.target.value)}
                  style={{ fontFamily: "inherit" }}>
                  {isOwner && <option value="OWNER">בעלים</option>}
                  {isAdmin && <option value="ADMIN">מנהל</option>}
                  <option value="MEMBER">חבר צוות</option>
                </select>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-faint)" }}>
              המשתמש יקבל מייל עם קישור להגדרת סיסמא וכניסה ראשונה.
            </p>
            {addErr && (
              <div style={{ display: "flex", gap: 6, fontSize: 12, color: "var(--red)",
                background: "var(--red-soft)", border: "1px solid var(--red-soft-strong)",
                borderRadius: "var(--r-sm)", padding: "7px 10px" }}>
                <AlertCircle size={13} />{addErr}
              </div>
            )}
            {addSetupUrl && (
              <div style={{ padding: "10px 12px", background: "#fff7ed",
                border: "1px solid #fed7aa", borderRadius: "var(--r-md)", fontSize: 12 }}>
                <p style={{ margin: "0 0 6px", fontWeight: 600, color: "#92400e" }}>
                  שליחת המייל נכשלה - שתף ידנית:
                </p>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ flex: 1, fontFamily: "monospace", direction: "ltr",
                    wordBreak: "break-all", color: "var(--accent)", fontSize: 11 }}>
                    {addSetupUrl}
                  </span>
                  <button type="button" className="btn btn-ghost sm"
                    onClick={() => navigator.clipboard.writeText(addSetupUrl)}
                    style={{ fontSize: 11 }}>העתק</button>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={adding} className="btn btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                {adding ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                הוסף וישלח מייל
              </button>
              <button type="button" onClick={() => { setShowAdd(false); setAddErr(""); setAddSetupUrl(""); }}
                className="btn btn-ghost">ביטול</button>
            </div>
          </form>
        </div>
      )}

      {rowErr && (
        <div style={{ display: "flex", gap: 6, fontSize: 13, color: "var(--red)",
          background: "var(--red-soft)", border: "1px solid var(--red-soft-strong)",
          borderRadius: "var(--r-md)", padding: "9px 14px" }}>
          <AlertCircle size={14} />{rowErr}
        </div>
      )}

      {/* Members table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-faint)" }} />
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface-sunken)" }}>
                {["משתמש", "הרשאה", "מוגדר", "הצטרף", ""].map((h, i) => (
                  <th key={i} style={{ padding: "10px 16px", textAlign: "start", fontWeight: 600,
                    color: "var(--text-muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => {
                const result = resendOk[m.id];
                return (
                  <tr key={m.id} style={{ borderBottom: i < members.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                    {/* User */}
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Initials name={m.name} email={m.email} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {m.name ?? m.email}
                            {m.id === currentUserId && (
                              <span style={{ marginInlineStart: 6, fontSize: 10, color: "var(--text-faint)",
                                background: "var(--surface-sunken)", border: "1px solid var(--border)",
                                borderRadius: 4, padding: "1px 5px" }}>אתה</span>
                            )}
                          </div>
                          {m.name && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)", direction: "ltr" }}>
                              {m.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td style={{ padding: "12px 16px" }}>
                      {canEditRole(m) ? (
                        <select
                          value={m.role}
                          onChange={e => changeRole(m.id, e.target.value)}
                          disabled={saving === m.id}
                          style={{ fontSize: 12, padding: "4px 8px", borderRadius: "var(--r-sm)",
                            border: "1px solid var(--border)", background: "var(--surface)",
                            fontFamily: "inherit", cursor: "pointer" }}>
                          <option value="OWNER">בעלים</option>
                          <option value="ADMIN">מנהל</option>
                          <option value="MEMBER">חבר צוות</option>
                        </select>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-muted)",
                          background: "var(--surface-sunken)", border: "1px solid var(--border)",
                          borderRadius: "var(--r-sm)", padding: "3px 8px" }}>
                          {ROLE_LABELS[m.role] ?? m.role}
                        </span>
                      )}
                      {saving === m.id && <Loader2 size={11} className="animate-spin" style={{ marginInlineStart: 6, color: "var(--text-faint)" }} />}
                    </td>

                    {/* Setup status */}
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <SetupBadge status={m.setupStatus} />
                        {(m.setupStatus === "expired" || m.setupStatus === "none") && isAdmin && (
                          <button
                            onClick={() => resendSetup(m)}
                            disabled={resending === m.id}
                            style={{ fontSize: 10, background: "none", border: "1px solid var(--border)",
                              borderRadius: 4, cursor: "pointer", padding: "2px 7px", color: "var(--text-muted)",
                              display: "inline-flex", alignItems: "center", gap: 3, width: "fit-content" }}>
                            {resending === m.id
                              ? <Loader2 size={9} className="animate-spin" />
                              : <Mail size={9} />}
                            שלח מחדש
                          </button>
                        )}
                        {result && (
                          result.ok
                            ? <span style={{ fontSize: 10, color: "#16a34a", display: "inline-flex", alignItems: "center", gap: 2 }}>
                                <CheckCircle2 size={10} /> נשלח
                              </span>
                            : <button type="button"
                                style={{ fontSize: 10, background: "none", border: "none", cursor: "pointer",
                                  color: "#ef4444", padding: 0, textDecoration: "underline" }}
                                onClick={() => result.url && navigator.clipboard.writeText(result.url)}>
                                ⚠ העתק קישור
                              </button>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 12, whiteSpace: "nowrap" }}>
                      {new Date(m.createdAt).toLocaleDateString("he-IL")}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "12px 16px", textAlign: "end" }}>
                      {canRemove(m) && (
                        <button
                          onClick={() => removeMember(m.id)}
                          disabled={removing === m.id}
                          title="הסר מהצוות"
                          style={{ background: "none", border: "none", cursor: "pointer",
                            color: "var(--red)", padding: 6, borderRadius: "var(--r-sm)" }}>
                          {removing === m.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : <X size={14} />}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {members.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-faint)" }}>
                    אין חברי צוות
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      <div style={{ fontSize: 11, color: "var(--text-faint)", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span><strong>בעלים</strong> - שליטה מלאה, ניהול הרשאות</span>
        <span><strong>מנהל</strong> - עריכת לקוחות ודוחות, הוספת חברי צוות</span>
        <span><strong>חבר צוות</strong> - צפייה בלבד</span>
      </div>
    </div>
  );
}
