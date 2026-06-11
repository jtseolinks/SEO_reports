"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Building2, Users, FileText, Globe, Plus, Pencil, Trash2,
  X, Check, Loader2, AlertCircle, CheckCircle2, ChevronDown,
  ChevronRight, ShieldCheck, Shield, UserPlus, RefreshCw, Wifi, WifiOff,
  LogIn, Mail, Send, Server,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Agency = {
  id: string; name: string; slug: string; createdAt: string;
  memberCount: number; clientCount: number; reportCount: number;
  googleStatus: string | null; googleEmail: string | null;
  owner: { email: string; name: string | null } | null;
  ownerSetupPending: boolean;
  setupPercent: number;
  setupChecks: { password: boolean; agencyName: boolean; google: boolean; team: boolean; smtp: boolean };
};

type SetupStatus = "complete" | "pending" | "expired" | "none";

type Member = {
  userId: string; email: string; name: string | null;
  role: string; isSuperAdmin: boolean; createdAt: string;
  setupStatus: SetupStatus;
};

type PlatformUser = {
  id: string; email: string; name: string | null;
  isSuperAdmin: boolean; createdAt: string;
  memberships: { agencyId: string; role: string; agency: { name: string } }[];
};

type Stats = { agencyCount: number; userCount: number; clientCount: number; reportCount: number };

type SmtpForm = {
  smtpHost: string; smtpPort: string; smtpUser: string;
  smtpPass: string; smtpFromEmail: string; smtpFromName: string;
};

const ROLE_LABELS: Record<string, string> = { OWNER: "בעלים", ADMIN: "מנהל", MEMBER: "חבר צוות" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function SetupBar({ percent, checks }: {
  percent: number;
  checks: { password: boolean; agencyName: boolean; google: boolean; team: boolean; smtp: boolean };
}) {
  const color = percent === 100 ? "#16a34a" : percent >= 60 ? "#f59e0b" : "#ef4444";
  const labels: [keyof typeof checks, string][] = [
    ["password", "סיסמא"],
    ["agencyName", "שם סוכנות"],
    ["google", "Google"],
    ["team", "צוות"],
    ["smtp", "SMTP"],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 110 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${percent}%`, background: color, borderRadius: 3,
            transition: "width 0.3s" }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 30, textAlign: "end" }}>
          {percent}%
        </span>
      </div>
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {labels.map(([key, label]) => (
          <span key={key} style={{
            fontSize: 9, padding: "1px 4px", borderRadius: 3, fontWeight: 600,
            background: checks[key] ? "#dcfce7" : "#f3f4f6",
            color: checks[key] ? "#15803d" : "#9ca3af",
            border: `1px solid ${checks[key] ? "#bbf7d0" : "#e5e7eb"}`,
          }}>
            {checks[key] ? "✓" : "○"} {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function MemberSetupBadge({ status }: { status: SetupStatus }) {
  const MAP: Record<SetupStatus, { label: string; bg: string; color: string; border: string }> = {
    complete: { label: "מוגדר ✓",   bg: "#dcfce7", color: "#15803d", border: "#bbf7d0" },
    pending:  { label: "ממתין ⏳",  bg: "#fef9c3", color: "#854d0e", border: "#fde68a" },
    expired:  { label: "פג תוקף ⚠", bg: "#fee2e2", color: "#991b1b", border: "#fecaca" },
    none:     { label: "לא נשלח",   bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" },
  };
  const s = MAP[status];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function Err({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12,
      color:"var(--red)", background:"var(--red-soft)", border:"1px solid var(--red-soft-strong)",
      borderRadius:"var(--r-sm)", padding:"7px 10px" }}>
      <AlertCircle size={13}/>{msg}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number; color: string;
}) {
  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"var(--r-lg)", padding:"18px 22px", display:"flex", alignItems:"center", gap:14 }}>
      <div style={{ width:42, height:42, borderRadius:10, flexShrink:0,
        background:`${color}18`, display:"grid", placeItems:"center" }}>
        <Icon size={19} style={{ color }}/>
      </div>
      <div>
        <div style={{ fontSize:22, fontWeight:700, lineHeight:1 }}>{value.toLocaleString()}</div>
        <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:3 }}>{label}</div>
      </div>
    </div>
  );
}

function GoogleBadge({ status, email }: { status: string | null; email: string | null }) {
  if (!status) return <span style={{ fontSize:11, color:"var(--text-faint)" }}>—</span>;
  const ok = status === "CONNECTED";
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11,
      color: ok ? "var(--green,#16a34a)" : "var(--red,#dc2626)" }}>
      {ok ? <Wifi size={11}/> : <WifiOff size={11}/>}
      {email ?? (ok ? "מחובר" : status)}
    </span>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:9000,
      background:"rgba(10,21,69,0.4)", backdropFilter:"blur(3px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:"var(--surface)", borderRadius:"var(--r-xl)",
        boxShadow:"0 24px 64px rgba(10,21,69,0.22)", width:"100%", maxWidth:520,
        maxHeight:"90vh", overflow:"auto" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"16px 20px", borderBottom:"1px solid var(--border)" }}>
          <span style={{ fontWeight:700, fontSize:15 }}>{title}</span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer",
            color:"var(--text-faint)", padding:4 }}>
            <X size={16}/>
          </button>
        </div>
        <div style={{ padding:"20px" }}>{children}</div>
      </div>
    </div>
  );
}

// ── Create Agency Modal ───────────────────────────────────────────────────────

function CreateAgencyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [agencyName, setAgencyName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName]   = useState("");
  const [loading, setLoading]       = useState(false);
  const [err, setErr]               = useState("");
  // When email send fails — show the setup URL so admin can share manually
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [emailErr, setEmailErr]       = useState("");
  // When email send succeeds — show a confirmation instead of closing silently
  const [sentOk, setSentOk]           = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setFallbackUrl(""); setEmailErr(""); setSentOk(false); setLoading(true);
    try {
      const res = await fetch("/api/super-admin/agencies", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ agencyName, ownerEmail, ownerName: ownerName || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "שגיאה"); return; }
      if (data.emailSent === false) {
        // Email failed — show manual link
        setFallbackUrl(data.setupUrl ?? "");
        setEmailErr(data.emailError ?? "שגיאה בשליחת המייל");
      } else {
        // Email sent — show explicit confirmation (don't close silently)
        setSentOk(true);
      }
    } finally { setLoading(false); }
  }

  // Email sent successfully — explicit confirmation
  if (sentOk) {
    return (
      <Modal title="סוכנות נוצרה ✓" onClose={onCreated}>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 14px",
            background:"#ecfdf5", border:"1px solid #a7f3d0", borderRadius:"var(--r-md)" }}>
            <CheckCircle2 size={16} style={{ color:"#16a34a", flexShrink:0, marginTop:1 }}/>
            <div style={{ fontSize:13 }}>
              <strong>מייל ההגדרה נשלח לבעלים.</strong><br/>
              <span style={{ color:"var(--text-muted)", direction:"ltr", display:"inline-block" }}>{ownerEmail}</span>
            </div>
          </div>
          <p style={{ fontSize:11, color:"var(--text-muted)", margin:0 }}>
            אם המייל לא הגיע — בדוק את תיקיית הספאם, או שלח מחדש מתוך טבלת הסוכנויות.
          </p>
          <button className="btn btn-primary" onClick={onCreated}>
            <CheckCircle2 size={14} style={{ display:"inline", marginLeft:5 }}/> סגור
          </button>
        </div>
      </Modal>
    );
  }

  // If email failed — show the fallback URL and let admin close
  if (fallbackUrl) {
    return (
      <Modal title="סוכנות נוצרה ✓" onClose={() => { setFallbackUrl(""); onCreated(); }}>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 14px",
            background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:"var(--r-md)" }}>
            <AlertCircle size={16} style={{ color:"#f97316", flexShrink:0, marginTop:1 }}/>
            <div style={{ fontSize:13 }}>
              <strong>לא הצלחנו לשלוח את המייל.</strong><br/>
              <span style={{ color:"var(--text-muted)" }}>{emailErr}</span>
            </div>
          </div>
          <div>
            <p style={{ fontSize:13, marginBottom:8, fontWeight:600 }}>
              שלח ידנית את קישור ההגדרה לבעלים:
            </p>
            <div style={{ display:"flex", gap:8, alignItems:"center",
              background:"var(--surface-sunken)", border:"1px solid var(--border)",
              borderRadius:"var(--r-md)", padding:"8px 12px" }}>
              <span style={{ flex:1, fontSize:12, fontFamily:"monospace", direction:"ltr",
                wordBreak:"break-all", color:"var(--accent)" }}>{fallbackUrl}</span>
              <button
                type="button"
                className="btn btn-ghost sm"
                onClick={() => { navigator.clipboard.writeText(fallbackUrl); }}
                style={{ flexShrink:0, fontSize:11 }}>
                העתק
              </button>
            </div>
            <p style={{ fontSize:11, color:"var(--text-muted)", marginTop:6 }}>
              הקישור תקף ל-7 ימים. הבעלים יצטרך להגדיר סיסמא דרך הקישור.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => { setFallbackUrl(""); onCreated(); }}>
            <CheckCircle2 size={14} style={{ display:"inline", marginLeft:5 }}/> סגור
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="סוכנות חדשה" onClose={onClose}>
      <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div className="field">
          <label className="field-label">שם הסוכנות *</label>
          <input className="rk-input" value={agencyName} onChange={e=>setAgencyName(e.target.value)}
            placeholder="Rankey SEO" required autoFocus/>
        </div>
        <div style={{ borderTop:"1px solid var(--border)", paddingTop:14 }}>
          <p style={{ fontSize:12, color:"var(--text-muted)", marginBottom:12 }}>
            בעלים ראשוני — ישלח מייל עם קישור הגדרה
          </p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div className="field">
              <label className="field-label">אימייל בעלים *</label>
              <input className="rk-input" type="email" value={ownerEmail}
                onChange={e=>setOwnerEmail(e.target.value)} dir="ltr"
                placeholder="owner@agency.com" required/>
            </div>
            <div className="field">
              <label className="field-label">שם (אופציונלי)</label>
              <input className="rk-input" value={ownerName}
                onChange={e=>setOwnerName(e.target.value)} placeholder="ישראל ישראלי"/>
            </div>
          </div>
          <p style={{ fontSize:11, color:"var(--text-faint)", marginTop:8 }}>
            הבעלים יקבל מייל עם קישור להגדרת סיסמא וכניסה ראשונה.
          </p>
        </div>
        <Err msg={err}/>
        <div style={{ display:"flex", gap:8 }}>
          <button type="submit" disabled={loading} className="btn btn-primary"
            style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
            {loading ? <Loader2 size={13} className="animate-spin"/> : <Plus size={13}/>} צור סוכנות חדשה
          </button>
          <button type="button" onClick={onClose} className="btn btn-ghost">ביטול</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Edit Agency Modal ─────────────────────────────────────────────────────────

function EditAgencyModal({ agency, onClose, onSaved }: {
  agency: Agency; onClose: () => void; onSaved: (a: Partial<Agency>) => void;
}) {
  const [name, setName]   = useState(agency.name);
  const [slug, setSlug]   = useState(agency.slug);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/agencies/${agency.id}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ name, slug }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "שגיאה"); return; }
      onSaved({ name, slug });
    } finally { setLoading(false); }
  }

  return (
    <Modal title={`עריכת סוכנות: ${agency.name}`} onClose={onClose}>
      <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div className="field">
          <label className="field-label">שם הסוכנות</label>
          <input className="rk-input" value={name} onChange={e=>setName(e.target.value)} required autoFocus/>
        </div>
        <div className="field">
          <label className="field-label">Slug (URL)</label>
          <input className="rk-input" value={slug} onChange={e=>setSlug(e.target.value)}
            dir="ltr" pattern="[a-z0-9-]+" required/>
          <p style={{ fontSize:11, color:"var(--text-faint)", marginTop:3 }}>
            אותיות קטנות, מספרים ומקפים בלבד
          </p>
        </div>
        <Err msg={err}/>
        <div style={{ display:"flex", gap:8 }}>
          <button type="submit" disabled={loading} className="btn btn-primary"
            style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
            {loading ? <Loader2 size={13} className="animate-spin"/> : <Check size={13}/>} שמור
          </button>
          <button type="button" onClick={onClose} className="btn btn-ghost">ביטול</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Agency Members Modal ──────────────────────────────────────────────────────

function MembersModal({ agency, onClose }: { agency: Agency; onClose: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [addEmail, setAddEmail]   = useState("");
  const [addRole, setAddRole]     = useState("MEMBER");
  const [adding, setAdding]       = useState(false);
  const [addErr, setAddErr]       = useState("");
  const [addSetupUrl, setAddSetupUrl] = useState("");
  const [saving, setSaving]       = useState<string | null>(null);
  const [removing, setRemoving]   = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [resendOk, setResendOk]   = useState<Record<string, { ok: boolean; url?: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/super-admin/agencies/${agency.id}/members`);
      const d = await r.json();
      setMembers(d.members ?? []);
    } finally { setLoading(false); }
  }, [agency.id]);

  useEffect(() => { load(); }, [load]);

  async function changeRole(userId: string, role: string) {
    setSaving(userId);
    await fetch(`/api/super-admin/agencies/${agency.id}/members/${userId}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ role }),
    });
    setMembers(prev => prev.map(m => m.userId===userId ? {...m, role} : m));
    setSaving(null);
  }

  async function removeMember(userId: string) {
    if (!confirm("להסיר את החבר מהסוכנות?")) return;
    setRemoving(userId);
    await fetch(`/api/super-admin/agencies/${agency.id}/members/${userId}`, { method:"DELETE" });
    setMembers(prev => prev.filter(m => m.userId !== userId));
    setRemoving(null);
  }

  async function resendSetup(userId: string) {
    setResending(userId);
    const res = await fetch(
      `/api/super-admin/agencies/${agency.id}/members/${userId}/resend-setup`,
      { method: "POST" }
    );
    const data = await res.json();
    if (!res.ok) { alert(data.error ?? "שגיאה"); setResending(null); return; }
    setResendOk(prev => ({ ...prev, [userId]: { ok: data.emailSent, url: data.setupUrl } }));
    // Refresh to update setupStatus from "expired"/"none" → "pending"
    await load();
    setResending(null);
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setAddErr(""); setAddSetupUrl(""); setAdding(true);
    try {
      const res = await fetch(`/api/super-admin/agencies/${agency.id}/members`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ email: addEmail, role: addRole }),
      });
      const data = await res.json();
      if (!res.ok) { setAddErr(data.error ?? "שגיאה"); return; }
      setAddEmail(""); setAddRole("MEMBER");
      if (data.setupUrl) setAddSetupUrl(data.setupUrl);
      await load();
    } finally { setAdding(false); }
  }

  return (
    <Modal title={`חברי צוות: ${agency.name}`} onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {/* Member list */}
        {loading ? (
          <div style={{ display:"flex", justifyContent:"center", padding:24 }}>
            <Loader2 size={20} className="animate-spin" style={{ color:"var(--text-faint)" }}/>
          </div>
        ) : members.length === 0 ? (
          <p style={{ fontSize:13, color:"var(--text-faint)", textAlign:"center", padding:"16px 0" }}>
            אין חברים
          </p>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {members.map(m => {
              const result = resendOk[m.userId];
              return (
                <div key={m.userId} style={{ display:"flex", alignItems:"flex-start", gap:10,
                  padding:"10px 12px", background:"var(--surface-sunken)",
                  borderRadius:"var(--r-md)", border:"1px solid var(--border-subtle)" }}>
                  {/* Avatar */}
                  <div style={{ width:30, height:30, borderRadius:"50%", flexShrink:0,
                    background:"var(--accent-soft)", display:"grid", placeItems:"center",
                    fontSize:11, fontWeight:700, color:"var(--accent)", marginTop:2 }}>
                    {(m.name || m.email)[0].toUpperCase()}
                  </div>
                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {m.name ?? m.email}
                      {m.isSuperAdmin && (
                        <span style={{ marginInlineStart:6, fontSize:10, color:"var(--brand-cyan)",
                          background:"rgba(91,194,240,0.15)", borderRadius:4, padding:"1px 5px" }}>SA</span>
                      )}
                    </div>
                    <div style={{ fontSize:11, color:"var(--text-muted)", direction:"ltr" }}>{m.email}</div>
                    {/* Setup status row */}
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5 }}>
                      <MemberSetupBadge status={m.setupStatus} />
                      {(m.setupStatus === "expired" || m.setupStatus === "none") && (
                        <button
                          onClick={() => resendSetup(m.userId)}
                          disabled={resending === m.userId}
                          style={{ fontSize:10, background:"none", border:"1px solid var(--border)",
                            borderRadius:4, cursor:"pointer", padding:"2px 7px", color:"var(--text-muted)",
                            display:"inline-flex", alignItems:"center", gap:3 }}>
                          {resending === m.userId
                            ? <Loader2 size={9} className="animate-spin"/>
                            : <RefreshCw size={9}/>}
                          שלח מחדש
                        </button>
                      )}
                      {result && (
                        result.ok
                          ? <span style={{ fontSize:10, color:"#16a34a", display:"inline-flex", alignItems:"center", gap:2 }}>
                              <CheckCircle2 size={10}/> נשלח
                            </span>
                          : <button type="button" style={{ fontSize:10, background:"none", border:"none",
                              cursor:"pointer", color:"#ef4444", padding:0, textDecoration:"underline" }}
                              onClick={() => result.url && navigator.clipboard.writeText(result.url)}>
                              ⚠ מייל נכשל — העתק קישור
                            </button>
                      )}
                    </div>
                  </div>
                  {/* Role selector */}
                  <select value={m.role}
                    onChange={e => changeRole(m.userId, e.target.value)}
                    disabled={saving === m.userId}
                    style={{ fontSize:12, padding:"3px 6px", borderRadius:"var(--r-sm)",
                      border:"1px solid var(--border)", background:"var(--surface)",
                      fontFamily:"inherit", cursor:"pointer", flexShrink:0 }}>
                    <option value="OWNER">בעלים</option>
                    <option value="ADMIN">מנהל</option>
                    <option value="MEMBER">חבר צוות</option>
                  </select>
                  {saving === m.userId && <Loader2 size={13} className="animate-spin" style={{ color:"var(--text-faint)", flexShrink:0 }}/>}
                  {/* Remove */}
                  <button onClick={() => removeMember(m.userId)} disabled={removing === m.userId}
                    style={{ background:"none", border:"none", cursor:"pointer",
                      color:"var(--red)", padding:4, flexShrink:0, marginTop:2 }}>
                    {removing === m.userId ? <Loader2 size={13} className="animate-spin"/> : <X size={13}/>}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add member form */}
        <div style={{ borderTop:"1px solid var(--border)", paddingTop:14 }}>
          <p style={{ fontSize:12, fontWeight:600, marginBottom:10 }}>הוסף חבר צוות</p>
          <form onSubmit={addMember} style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div className="field">
                <label className="field-label">אימייל *</label>
                <input className="rk-input" type="email" value={addEmail}
                  onChange={e=>setAddEmail(e.target.value)} dir="ltr" required
                  placeholder="user@example.com"/>
              </div>
              <div className="field">
                <label className="field-label">הרשאה</label>
                <select className="rk-input" value={addRole} onChange={e=>setAddRole(e.target.value)}
                  style={{ fontFamily:"inherit" }}>
                  <option value="OWNER">בעלים</option>
                  <option value="ADMIN">מנהל</option>
                  <option value="MEMBER">חבר צוות</option>
                </select>
              </div>
            </div>
            <p style={{ fontSize:11, color:"var(--text-faint)", margin:0 }}>
              המשתמש יקבל מייל עם קישור להגדרת סיסמא וכניסה ראשונה.
            </p>
            <Err msg={addErr}/>
            {addSetupUrl && (
              <div style={{ padding:"10px 12px", background:"#fff7ed",
                border:"1px solid #fed7aa", borderRadius:"var(--r-md)", fontSize:12 }}>
                <p style={{ margin:"0 0 6px", fontWeight:600, color:"#92400e" }}>
                  שליחת המייל נכשלה — שתף ידנית:
                </p>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <span style={{ flex:1, fontFamily:"monospace", direction:"ltr",
                    wordBreak:"break-all", color:"#1E2D7D", fontSize:11 }}>{addSetupUrl}</span>
                  <button type="button" className="btn btn-ghost sm"
                    onClick={() => navigator.clipboard.writeText(addSetupUrl)}
                    style={{ flexShrink:0, fontSize:11 }}>העתק</button>
                </div>
              </div>
            )}
            <button type="submit" disabled={adding || !addEmail} className="btn btn-primary sm"
              style={{ display:"inline-flex", alignItems:"center", gap:5, alignSelf:"start" }}>
              {adding ? <Loader2 size={12} className="animate-spin"/> : <UserPlus size={12}/>}
              הוסף חבר צוות
            </button>
          </form>
        </div>
      </div>
    </Modal>
  );
}

// ── Edit User Modal ───────────────────────────────────────────────────────────

type RoleOption = {
  value: string;
  label: string;
  desc: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ElementType;
};

const ROLE_OPTIONS: RoleOption[] = [
  { value:"MEMBER",      label:"חבר צוות",  desc:"צפייה בלבד",                   color:"#374151", bg:"#f9fafb",              border:"#e5e7eb",              icon:Shield },
  { value:"ADMIN",       label:"מנהל",       desc:"עריכה והוספת חברי צוות",        color:"#1E2D7D", bg:"rgba(30,45,125,0.06)", border:"rgba(30,45,125,0.2)", icon:ShieldCheck },
  { value:"OWNER",       label:"בעלים",      desc:"שליטה מלאה בסוכנות",            color:"#d97706", bg:"rgba(217,119,6,0.08)", border:"rgba(217,119,6,0.25)", icon:ShieldCheck },
  { value:"SUPER_ADMIN", label:"Super Admin", desc:"ניהול פלטפורמה מלא",            color:"#0891b2", bg:"rgba(8,145,178,0.08)", border:"rgba(8,145,178,0.25)", icon:ShieldCheck },
];

function RolePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <span className="field-label">תפקיד והרשאה</span>
      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
        {ROLE_OPTIONS.map(opt => {
          const active = value === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              style={{
                display:"flex", alignItems:"center", gap:10,
                padding:"10px 14px", borderRadius:"var(--r-md)", cursor:"pointer",
                textAlign:"start", width:"100%",
                background: active ? opt.bg : "var(--surface-sunken)",
                border: `2px solid ${active ? opt.border : "var(--border)"}`,
                transition:"all 0.12s",
              }}>
              <div style={{ width:20, height:20, borderRadius:"50%", flexShrink:0,
                border:`2px solid ${active ? opt.color : "var(--border)"}`,
                display:"grid", placeItems:"center",
                background: active ? opt.color : "transparent" }}>
                {active && <div style={{ width:7, height:7, borderRadius:"50%", background:"white" }}/>}
              </div>
              <Icon size={15} style={{ color: active ? opt.color : "var(--text-faint)", flexShrink:0 }}/>
              <div style={{ flex:1, lineHeight:1.3 }}>
                <div style={{ fontSize:13, fontWeight:active ? 700 : 500,
                  color: active ? opt.color : "var(--text)" }}>{opt.label}</div>
                <div style={{ fontSize:11, color:"var(--text-faint)" }}>{opt.desc}</div>
              </div>
              {active && <Check size={13} style={{ color:opt.color, flexShrink:0 }}/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function resolveRoleValue(user: PlatformUser): string {
  if (user.isSuperAdmin) return "SUPER_ADMIN";
  return user.memberships[0]?.role ?? "MEMBER";
}

function EditUserModal({ user, onClose, onSaved }: {
  user: PlatformUser;
  onClose: () => void;
  onSaved: (updated: PlatformUser) => void;
}) {
  const [name, setName]     = useState(user.name ?? "");
  const [email, setEmail]   = useState(user.email);
  const [roleValue, setRoleValue] = useState(resolveRoleValue(user));
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  const [resetting, setResetting]     = useState(false);
  const [resetResult, setResetResult] = useState<{ ok: boolean; url?: string } | null>(null);
  const [deleting, setDeleting]       = useState(false);

  async function deleteUser() {
    if (!confirm(`למחוק את המשתמש "${user.name ?? user.email}"? פעולה זו בלתי הפיכה.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/super-admin/users/${user.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { alert(data.error ?? "שגיאה במחיקה"); setDeleting(false); return; }
    onClose();
    // Signal parent to remove user from list
    onSaved({ ...user, id: "__deleted__" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setSaving(true);
    try {
      const isSuperAdmin = roleValue === "SUPER_ADMIN";
      const membershipRole = isSuperAdmin ? undefined : roleValue;
      const res = await fetch(`/api/super-admin/users/${user.id}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          name: name.trim() || null,
          email: email.trim(),
          isSuperAdmin,
          membershipRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "שגיאה"); return; }
      onSaved({
        ...user,
        name: data.user.name,
        email: data.user.email,
        isSuperAdmin: data.user.isSuperAdmin,
        memberships: membershipRole
          ? user.memberships.map(m => ({ ...m, role: membershipRole }))
          : user.memberships,
      });
    } finally { setSaving(false); }
  }

  async function resetPassword() {
    setResetting(true); setResetResult(null);
    const res = await fetch(`/api/super-admin/users/${user.id}/reset-password`, { method:"POST" });
    const data = await res.json();
    setResetResult({ ok: data.emailSent, url: data.resetUrl });
    setResetting(false);
  }

  return (
    <Modal title={`עריכת משתמש — ${user.name ?? user.email}`} onClose={onClose}>
      <form onSubmit={save} style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div className="field">
          <label className="field-label">שם מלא</label>
          <input className="rk-input" value={name} onChange={e=>setName(e.target.value)}
            placeholder="שם מלא (אופציונלי)"/>
        </div>
        <div className="field">
          <label className="field-label">כתובת מייל *</label>
          <input className="rk-input" type="email" required dir="ltr"
            value={email} onChange={e=>setEmail(e.target.value)}/>
        </div>

        <RolePicker value={roleValue} onChange={setRoleValue}/>

        {err && (
          <div style={{ display:"flex", gap:6, fontSize:12, color:"var(--red)",
            background:"var(--red-soft)", borderRadius:"var(--r-sm)", padding:"7px 10px" }}>
            <AlertCircle size={13}/>{err}
          </div>
        )}

        <div style={{ display:"flex", gap:8, justifyContent:"space-between", alignItems:"center",
          borderTop:"1px solid var(--border)", paddingTop:14, marginTop:4 }}>
          <div style={{ display:"flex", gap:8 }}>
            <button type="submit" disabled={saving || deleting} className="btn btn-primary sm"
              style={{ display:"inline-flex", alignItems:"center", gap:5 }}>
              {saving ? <Loader2 size={12} className="animate-spin"/> : <Check size={12}/>}
              שמור שינויים
            </button>
            <button type="button" onClick={onClose} className="btn btn-ghost sm">ביטול</button>
            <button type="button" onClick={deleteUser} disabled={deleting}
              style={{ display:"inline-flex", alignItems:"center", gap:5,
                background:"none", border:"1px solid var(--red,#dc2626)", borderRadius:"var(--r-md)",
                color:"var(--red,#dc2626)", fontSize:12, fontWeight:600, padding:"5px 12px",
                cursor:"pointer", marginInlineStart:4 }}>
              {deleting ? <Loader2 size={11} className="animate-spin"/> : <Trash2 size={11}/>}
              מחק משתמש
            </button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5 }}>
            <button type="button" onClick={resetPassword} disabled={resetting}
              className="btn btn-ghost sm"
              style={{ display:"inline-flex", alignItems:"center", gap:5,
                color:"var(--text-muted)", fontSize:12 }}>
              {resetting ? <Loader2 size={11} className="animate-spin"/> : <RefreshCw size={11}/>}
              שלח מייל איפוס סיסמא
            </button>
            {resetResult && (
              resetResult.ok
                ? <span style={{ fontSize:11, color:"#16a34a", display:"inline-flex", alignItems:"center", gap:3 }}>
                    <CheckCircle2 size={11}/> מייל נשלח
                  </span>
                : <div style={{ fontSize:11, display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ color:"#ef4444" }}>שליחה נכשלה —</span>
                    {resetResult.url && (
                      <button type="button" style={{ fontSize:11, background:"none", border:"none",
                        cursor:"pointer", color:"var(--accent)", padding:0, textDecoration:"underline" }}
                        onClick={() => resetResult.url && navigator.clipboard.writeText(resetResult.url)}>
                        העתק קישור
                      </button>
                    )}
                  </div>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers]     = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<PlatformUser | null>(null);
  const [search, setSearch]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/super-admin/users");
      const d = await r.json();
      setUsers(d.users ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display:"flex", justifyContent:"center", padding:40 }}>
      <Loader2 size={22} className="animate-spin" style={{ color:"var(--text-faint)" }}/>
    </div>
  );

  return (
    <>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
        borderRadius:"var(--r-lg)", overflow:"hidden" }}>
        <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)",
          display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <h2 style={{ fontSize:14, fontWeight:700, margin:0, marginInlineEnd:"auto" }}>
            משתמשי פלטפורמה ({users.length})
          </h2>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם או מייל..."
            style={{ fontSize:13, padding:"6px 12px", border:"1px solid var(--border)",
              borderRadius:"var(--r-md)", background:"var(--surface-sunken)",
              outline:"none", width:220, direction:"rtl" }}
          />
          <button onClick={load} className="btn btn-ghost sm"
            style={{ display:"inline-flex", alignItems:"center", gap:5 }}>
            <RefreshCw size={12}/> רענן
          </button>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"var(--surface-sunken)" }}>
                {["משתמש", "סוכנויות", "הרשאה", "נוצר", ""].map((h,i) => (
                  <th key={i} style={{ padding:"9px 16px", textAlign:"start", fontWeight:600,
                    color:"var(--text-muted)", borderBottom:"1px solid var(--border)", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.filter(u => {
                if (!search.trim()) return true;
                const q = search.trim().toLowerCase();
                return (u.email.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q));
              }).map((u, i, arr) => (
                <tr key={u.id}
                  style={{ borderBottom: i < arr.length-1 ? "1px solid var(--border-subtle)" : "none" }}>
                  <td style={{ padding:"11px 16px" }}>
                    <div style={{ fontWeight:600 }}>{u.name ?? u.email}</div>
                    {u.name && <div style={{ fontSize:11, color:"var(--text-muted)", direction:"ltr" }}>{u.email}</div>}
                  </td>
                  <td style={{ padding:"11px 16px" }}>
                    {u.memberships.length === 0 ? (
                      <span style={{ fontSize:12, color:"var(--text-faint)" }}>—</span>
                    ) : (
                      <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                        {u.memberships.slice(0,3).map((m, j) => (
                          <span key={j} style={{ fontSize:11, color:"var(--text-muted)" }}>
                            {m.agency.name} · {ROLE_LABELS[m.role]??m.role}
                          </span>
                        ))}
                        {u.memberships.length > 3 && (
                          <span style={{ fontSize:11, color:"var(--text-faint)" }}>
                            +{u.memberships.length - 3} נוספים
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ padding:"11px 16px" }}>
                    {u.isSuperAdmin ? (
                      <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11,
                        background:"rgba(91,194,240,0.15)", color:"var(--brand-cyan)",
                        border:"1px solid rgba(91,194,240,0.3)", borderRadius:"var(--r-pill)",
                        padding:"3px 10px", fontWeight:600 }}>
                        <ShieldCheck size={10}/> Super-admin
                      </span>
                    ) : (
                      <span style={{ fontSize:11, color:"var(--text-muted)",
                        background:"var(--surface-sunken)", border:"1px solid var(--border)",
                        borderRadius:"var(--r-pill)", padding:"3px 10px" }}>רגיל</span>
                    )}
                  </td>
                  <td style={{ padding:"11px 16px", color:"var(--text-muted)", fontSize:12, whiteSpace:"nowrap" }}>
                    {new Date(u.createdAt).toLocaleDateString("he-IL")}
                  </td>
                  <td style={{ padding:"11px 16px", textAlign:"end" }}>
                    <button onClick={() => setEditUser(u)}
                      title="עריכה"
                      style={{ background:"none", border:"none", cursor:"pointer",
                        color:"var(--text-muted)", padding:5, borderRadius:"var(--r-sm)" }}>
                      <Pencil size={13}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={(updated) => {
            if (updated.id === "__deleted__") {
              setUsers(prev => prev.filter(u => u.id !== editUser!.id));
            } else {
              setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
            }
            setEditUser(null);
          }}
        />
      )}
    </>
  );
}

// ── SMTP Tab ──────────────────────────────────────────────────────────────────

function SmtpTab() {
  const [form, setForm]       = useState<SmtpForm | null>(null);
  const [saving, setSaving]   = useState(false);
  const [saveResult, setSaveResult] = useState<"ok" | "err" | null>(null);
  const [testTo, setTestTo]   = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetch("/api/super-admin/smtp")
      .then(r => r.json())
      .then(d => setForm({
        smtpHost:      d.smtpHost      ?? "",
        smtpPort:      d.smtpPort      ?? "587",
        smtpUser:      d.smtpUser      ?? "",
        smtpPass:      d.smtpPass      ?? "",
        smtpFromEmail: d.smtpFromEmail ?? "",
        smtpFromName:  d.smtpFromName  ?? "",
      }))
      .catch(() => setForm({ smtpHost:"", smtpPort:"587", smtpUser:"", smtpPass:"", smtpFromEmail:"", smtpFromName:"" }));
  }, []);

  function upd(k: keyof SmtpForm, v: string) {
    setForm(f => (f ? { ...f, [k]: v } : f));
    setSaveResult(null);
  }

  async function save() {
    if (!form) return;
    setSaving(true); setSaveResult(null);
    try {
      const res = await fetch("/api/super-admin/smtp", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSaveResult(res.ok ? "ok" : "err");
    } catch {
      setSaveResult("err");
    } finally { setSaving(false); }
  }

  async function test() {
    if (!testTo) return;
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch("/api/super-admin/smtp/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      const d = await res.json();
      setTestResult(res.ok ? { ok: true, msg: "מייל נשלח בהצלחה!" } : { ok: false, msg: d.error ?? "שגיאה בשליחה" });
    } catch {
      setTestResult({ ok: false, msg: "שגיאת רשת" });
    } finally { setTesting(false); }
  }

  if (!form) return (
    <div style={{ display:"flex", justifyContent:"center", padding:40 }}>
      <Loader2 size={22} className="animate-spin" style={{ color:"var(--text-faint)" }}/>
    </div>
  );

  const cardStyle: React.CSSProperties = {
    background:"var(--surface)", border:"1px solid var(--border)",
    borderRadius:"var(--r-lg)", padding:"20px 22px", maxWidth:640,
  };
  const labelStyle: React.CSSProperties = {
    display:"block", fontSize:12, fontWeight:600, color:"var(--text-muted)", marginBottom:5,
  };
  const inputStyle: React.CSSProperties = {
    width:"100%", fontSize:13, padding:"8px 12px", border:"1px solid var(--border)",
    borderRadius:"var(--r-md)", background:"var(--surface-sunken)", outline:"none", boxSizing:"border-box",
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* SMTP server config */}
      <div style={cardStyle}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
          <Server size={16} style={{ color:"var(--accent)" }}/>
          <h2 style={{ fontSize:15, fontWeight:700, margin:0 }}>הגדרות שרת דואר (SMTP)</h2>
        </div>
        <p style={{ fontSize:12.5, color:"var(--text-muted)", margin:"0 0 18px", lineHeight:1.6 }}>
          שרת דואר יחיד לכל המערכת — משמש לשליחת דוחות, הזמנות והגדרת סוכנויות. מומלץ: <strong>Brevo</strong> (300 מיילים/יום חינם).
        </p>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 110px", gap:12, marginBottom:14 }}>
          <div>
            <label style={labelStyle}>שרת SMTP (Host)</label>
            <input style={inputStyle} dir="ltr" value={form.smtpHost}
              onChange={e => upd("smtpHost", e.target.value)} placeholder="smtp-relay.brevo.com"/>
          </div>
          <div>
            <label style={labelStyle}>פורט</label>
            <input style={inputStyle} dir="ltr" value={form.smtpPort}
              onChange={e => upd("smtpPort", e.target.value)} placeholder="587"/>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <div>
            <label style={labelStyle}>שם משתמש</label>
            <input style={inputStyle} dir="ltr" value={form.smtpUser}
              onChange={e => upd("smtpUser", e.target.value)} placeholder="your@email.com"/>
          </div>
          <div>
            <label style={labelStyle}>סיסמה / SMTP Key</label>
            <input style={inputStyle} dir="ltr" type="password" value={form.smtpPass}
              onChange={e => upd("smtpPass", e.target.value)} placeholder="••••••••"/>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
          <div>
            <label style={labelStyle}>שם השולח (From)</label>
            <input style={inputStyle} value={form.smtpFromName}
              onChange={e => upd("smtpFromName", e.target.value)} placeholder="Rankey SEO Reports"/>
          </div>
          <div>
            <label style={labelStyle}>כתובת השולח (From)</label>
            <input style={inputStyle} dir="ltr" value={form.smtpFromEmail}
              onChange={e => upd("smtpFromEmail", e.target.value)} placeholder="reports@rankey.co.il"/>
          </div>
        </div>

        <div style={{ background:"var(--surface-sunken)", borderRadius:"var(--r-md)", padding:"10px 14px",
          fontSize:12, color:"var(--text-muted)", lineHeight:1.6, marginBottom:16 }}>
          <strong>Brevo (חינמי):</strong> smtp-relay.brevo.com · פורט 587 · שם משתמש = האימייל שלך ב-Brevo · סיסמה = SMTP key מ-<span dir="ltr">Settings → SMTP &amp; API</span>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={save} disabled={saving} className="btn btn-primary"
            style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
            {saving ? <Loader2 size={13} className="animate-spin"/> : <Check size={13}/>} שמור הגדרות
          </button>
          {saveResult === "ok"  && <span style={{ fontSize:13, color:"var(--green,#16a34a)", display:"inline-flex", alignItems:"center", gap:5 }}><CheckCircle2 size={14}/> נשמר</span>}
          {saveResult === "err" && <span style={{ fontSize:13, color:"var(--red,#dc2626)", display:"inline-flex", alignItems:"center", gap:5 }}><AlertCircle size={14}/> שגיאה בשמירה</span>}
        </div>
      </div>

      {/* Test send */}
      <div style={cardStyle}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
          <Mail size={16} style={{ color:"var(--accent)" }}/>
          <h2 style={{ fontSize:15, fontWeight:700, margin:0 }}>בדיקת שליחה</h2>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
          <div style={{ flex:1 }}>
            <label style={labelStyle}>שלח מייל ניסיון אל</label>
            <input style={inputStyle} dir="ltr" type="email" value={testTo}
              onChange={e => setTestTo(e.target.value)} placeholder="your@email.com"
              onKeyDown={e => { if (e.key === "Enter") test(); }}/>
          </div>
          <button onClick={test} disabled={testing || !testTo} className="btn btn-secondary"
            style={{ display:"inline-flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>
            {testing ? <Loader2 size={13} className="animate-spin"/> : <Send size={13}/>} שלח בדיקה
          </button>
        </div>
        {testResult && (
          <div style={{ marginTop:12, fontSize:12.5, display:"flex", alignItems:"center", gap:6,
            color: testResult.ok ? "var(--green,#16a34a)" : "var(--red,#dc2626)" }}>
            {testResult.ok ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>} {testResult.msg}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SuperAdminClient({ initialStats }: { initialStats: Stats }) {
  const router = useRouter();
  const { update: updateSession } = useSession();

  const [activeTab, setActiveTab]     = useState<"agencies" | "users" | "smtp">("agencies");
  const [agencies, setAgencies]       = useState<Agency[]>([]);
  const [stats, setStats]             = useState<Stats>(initialStats);
  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [editAgency, setEditAgency]   = useState<Agency | null>(null);
  const [membersAgency, setMembersAgency] = useState<Agency | null>(null);
  const [deleting, setDeleting]       = useState<string | null>(null);
  const [resending, setResending]     = useState<string | null>(null);
  const [resendResult, setResendResult] = useState<{ agencyId: string; setupUrl?: string; ok: boolean } | null>(null);
  const [entering, setEntering]       = useState<string | null>(null);

  const loadAgencies = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/super-admin/agencies");
      const d = await r.json();
      setAgencies(d.agencies ?? []);
      setStats(s => ({ ...s, agencyCount: (d.agencies ?? []).length }));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAgencies(); }, [loadAgencies]);

  async function resendSetup(a: Agency) {
    setResending(a.id); setResendResult(null);
    const res = await fetch(`/api/super-admin/agencies/${a.id}/resend-setup`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { alert(data.error ?? "שגיאה"); setResending(null); return; }
    setResendResult({ agencyId: a.id, setupUrl: data.setupUrl, ok: data.emailSent });
    setResending(null);
  }

  async function deleteAgency(a: Agency) {
    if (!confirm(`למחוק את "${a.name}"? פעולה זו בלתי הפיכה — כל הלקוחות, הדוחות והחיבורים יימחקו.`)) return;
    setDeleting(a.id);
    await fetch(`/api/super-admin/agencies/${a.id}`, { method:"DELETE" });
    setAgencies(prev => prev.filter(ag => ag.id !== a.id));
    setDeleting(null);
  }

  async function enterAgency(a: Agency) {
    setEntering(a.id);
    try {
      const res = await fetch(`/api/super-admin/agencies/${a.id}/enter`, { method: "POST" });
      if (!res.ok) { alert("שגיאה בכניסה לסוכנות"); return; }
      // Re-issue JWT with new agencyId (super-admin bypass in jwt callback)
      await updateSession({ agencyId: a.id });
      router.push("/admin");
    } finally {
      setEntering(null);
    }
  }

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding:"8px 18px", fontSize:13, fontWeight:600, cursor:"pointer",
    border:"none", background:"none",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    color: active ? "var(--accent)" : "var(--text-muted)",
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:28 }}>

      {/* Tabs */}
      <div style={{ borderBottom:"1px solid var(--border)", display:"flex", gap:0 }}>
        <button onClick={() => setActiveTab("agencies")} style={TAB_STYLE(activeTab==="agencies")}>
          סוכנויות
        </button>
        <button onClick={() => setActiveTab("users")} style={TAB_STYLE(activeTab==="users")}>
          משתמשים
        </button>
        <button onClick={() => setActiveTab("smtp")} style={TAB_STYLE(activeTab==="smtp")}>
          הגדרות מייל
        </button>
      </div>

      {activeTab === "agencies" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {/* Toolbar */}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => setShowCreate(true)} className="btn btn-primary"
              style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
              <Plus size={14}/> סוכנות חדשה
            </button>
            <button onClick={loadAgencies} className="btn btn-ghost"
              style={{ display:"inline-flex", alignItems:"center", gap:5 }}>
              <RefreshCw size={13}/> רענן
            </button>
          </div>

          {/* Agencies table */}
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
            borderRadius:"var(--r-lg)", overflow:"hidden" }}>
            {loading ? (
              <div style={{ display:"flex", justifyContent:"center", padding:40 }}>
                <Loader2 size={22} className="animate-spin" style={{ color:"var(--text-faint)" }}/>
              </div>
            ) : (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr style={{ background:"var(--surface-sunken)" }}>
                      {["סוכנות", "בעלים", "מוגדר", "חברים", "לקוחות", "דוחות", "Google", "תאריך", "פעולות"].map(h => (
                        <th key={h} style={{ padding:"9px 14px", textAlign:"start", fontWeight:600,
                          color:"var(--text-muted)", borderBottom:"1px solid var(--border)", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agencies.map((a, i) => (
                      <tr key={a.id}
                        onClick={() => enterAgency(a)}
                        style={{ borderBottom: i < agencies.length-1 ? "1px solid var(--border-subtle)" : "none",
                          cursor: entering === a.id ? "wait" : "pointer" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-sunken)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}>
                        <td style={{ padding:"11px 14px" }}>
                          <div style={{ fontWeight:600 }}>{a.name}</div>
                          <div style={{ fontSize:11, color:"var(--text-faint)", fontFamily:"monospace" }}>{a.slug}</div>
                        </td>
                        <td style={{ padding:"11px 14px" }} onClick={e => e.stopPropagation()}>
                          {a.owner ? (
                            <div>
                              <div style={{ fontSize:12, display:"flex", alignItems:"center", gap:5 }}>
                                {a.owner.name ?? "—"}
                                {a.ownerSetupPending && (
                                  <span style={{ fontSize:10, background:"#fef3c7", color:"#92400e",
                                    border:"1px solid #fcd34d", borderRadius:4, padding:"1px 5px", fontWeight:600 }}>
                                    ⚠ לא הוגדר
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize:11, color:"var(--text-muted)", direction:"ltr" }}>{a.owner.email}</div>
                              {a.ownerSetupPending && (
                                <>
                                  <button
                                    onClick={() => resendSetup(a)}
                                    disabled={resending === a.id}
                                    style={{ marginTop:4, fontSize:10, background:"none", border:"1px solid var(--border)",
                                      borderRadius:4, cursor:"pointer", padding:"2px 7px", color:"var(--text-muted)",
                                      display:"inline-flex", alignItems:"center", gap:3 }}>
                                    {resending === a.id
                                      ? <Loader2 size={9} className="animate-spin"/>
                                      : <RefreshCw size={9}/>}
                                    שלח מייל שוב
                                  </button>
                                  {resendResult?.agencyId === a.id && (
                                    <div style={{ marginTop:4 }}>
                                      {resendResult.ok ? (
                                        <span style={{ fontSize:10, color:"var(--green,#16a34a)" }}>
                                          <CheckCircle2 size={10} style={{ display:"inline", marginLeft:2 }}/>
                                          נשלח
                                        </span>
                                      ) : (
                                        <div style={{ fontSize:10 }}>
                                          <span style={{ color:"#ef4444" }}>מייל נכשל — </span>
                                          <button type="button" style={{ fontSize:10, background:"none", border:"none",
                                            cursor:"pointer", color:"#1E2D7D", textDecoration:"underline", padding:0 }}
                                            onClick={() => resendResult.setupUrl && navigator.clipboard.writeText(resendResult.setupUrl)}>
                                            העתק קישור
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ) : <span style={{ color:"var(--text-faint)", fontSize:12 }}>—</span>}
                        </td>
                        <td style={{ padding:"11px 14px" }}>
                          <SetupBar percent={a.setupPercent} checks={a.setupChecks} />
                        </td>
                        <td style={{ padding:"11px 14px", textAlign:"center" }}>{a.memberCount}</td>
                        <td style={{ padding:"11px 14px", textAlign:"center" }}>{a.clientCount}</td>
                        <td style={{ padding:"11px 14px", textAlign:"center" }}>{a.reportCount}</td>
                        <td style={{ padding:"11px 14px" }}>
                          <GoogleBadge status={a.googleStatus} email={a.googleEmail}/>
                        </td>
                        <td style={{ padding:"11px 14px", color:"var(--text-muted)", fontSize:12, whiteSpace:"nowrap" }}>
                          {new Date(a.createdAt).toLocaleDateString("he-IL")}
                        </td>
                        <td style={{ padding:"11px 14px" }} onClick={e => e.stopPropagation()}>
                          <div style={{ display:"flex", gap:4, justifyContent:"flex-end", alignItems:"center" }}>
                            {entering === a.id && (
                              <Loader2 size={12} className="animate-spin" style={{ color:"var(--accent)" }}/>
                            )}
                            <button onClick={e => { e.stopPropagation(); enterAgency(a); }}
                              disabled={entering === a.id}
                              title="כנס לסוכנות"
                              style={{ background:"none", border:"none", cursor:"pointer",
                                color:"var(--accent)", padding:5, borderRadius:"var(--r-sm)" }}>
                              <LogIn size={13}/>
                            </button>
                            <button onClick={e => { e.stopPropagation(); setMembersAgency(a); }}
                              title="ניהול חברים"
                              style={{ background:"none", border:"none", cursor:"pointer",
                                color:"var(--text-muted)", padding:5, borderRadius:"var(--r-sm)" }}>
                              <Users size={13}/>
                            </button>
                            <button onClick={e => { e.stopPropagation(); setEditAgency(a); }}
                              title="עריכה"
                              style={{ background:"none", border:"none", cursor:"pointer",
                                color:"var(--text-muted)", padding:5, borderRadius:"var(--r-sm)" }}>
                              <Pencil size={13}/>
                            </button>
                            <button onClick={e => { e.stopPropagation(); deleteAgency(a); }}
                              disabled={deleting === a.id}
                              title="מחק סוכנות"
                              style={{ background:"none", border:"none", cursor:"pointer",
                                color:"var(--red)", padding:5, borderRadius:"var(--r-sm)" }}>
                              {deleting === a.id ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {agencies.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ padding:"32px 16px", textAlign:"center",
                          color:"var(--text-faint)" }}>אין סוכנויות</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "users" && <UsersTab/>}

      {activeTab === "smtp" && <SmtpTab/>}

      {/* Modals */}
      {showCreate && (
        <CreateAgencyModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadAgencies(); }}
        />
      )}
      {editAgency && (
        <EditAgencyModal
          agency={editAgency}
          onClose={() => setEditAgency(null)}
          onSaved={(patch) => {
            setAgencies(prev => prev.map(a => a.id===editAgency.id ? {...a,...patch} : a));
            setEditAgency(null);
          }}
        />
      )}
      {membersAgency && (
        <MembersModal agency={membersAgency} onClose={() => setMembersAgency(null)}/>
      )}
    </div>
  );
}
