"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2, Users, FileText, Globe, Plus, Pencil, Trash2,
  X, Check, Loader2, AlertCircle, CheckCircle2, ChevronDown,
  ChevronRight, ShieldCheck, Shield, UserPlus, RefreshCw, Wifi, WifiOff,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Agency = {
  id: string; name: string; slug: string; createdAt: string;
  memberCount: number; clientCount: number; reportCount: number;
  googleStatus: string | null; googleEmail: string | null;
  owner: { email: string; name: string | null } | null;
};

type Member = {
  userId: string; email: string; name: string | null;
  role: string; isSuperAdmin: boolean; createdAt: string;
};

type PlatformUser = {
  id: string; email: string; name: string | null;
  isSuperAdmin: boolean; createdAt: string;
  memberships: { role: string; agency: { name: string } }[];
};

type Stats = { agencyCount: number; userCount: number; clientCount: number; reportCount: number };

const ROLE_LABELS: Record<string, string> = { OWNER: "בעלים", ADMIN: "מנהל", MEMBER: "חבר צוות" };

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  const [ownerPw, setOwnerPw]       = useState("");
  const [loading, setLoading]       = useState(false);
  const [err, setErr]               = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const res = await fetch("/api/super-admin/agencies", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ agencyName, ownerEmail: ownerEmail || undefined,
          ownerName: ownerName || undefined, ownerPassword: ownerPw || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "שגיאה"); return; }
      onCreated();
    } finally { setLoading(false); }
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
            בעלים ראשוני (אופציונלי — ניתן להוסיף מאוחר יותר)
          </p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div className="field">
              <label className="field-label">אימייל בעלים</label>
              <input className="rk-input" type="email" value={ownerEmail}
                onChange={e=>setOwnerEmail(e.target.value)} dir="ltr" placeholder="owner@agency.com"/>
            </div>
            <div className="field">
              <label className="field-label">שם</label>
              <input className="rk-input" value={ownerName}
                onChange={e=>setOwnerName(e.target.value)} placeholder="ישראל ישראלי"/>
            </div>
          </div>
          {ownerEmail && (
            <div className="field" style={{ marginTop:10 }}>
              <label className="field-label">סיסמה (אם משתמש חדש)</label>
              <input className="rk-input" type="password" value={ownerPw}
                onChange={e=>setOwnerPw(e.target.value)} dir="ltr" placeholder="מינימום 8 תווים"/>
            </div>
          )}
        </div>
        <Err msg={err}/>
        <div style={{ display:"flex", gap:8 }}>
          <button type="submit" disabled={loading} className="btn btn-primary"
            style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
            {loading ? <Loader2 size={13} className="animate-spin"/> : <Plus size={13}/>} צור סוכנות
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
  const [addName, setAddName]     = useState("");
  const [addPw, setAddPw]         = useState("");
  const [addRole, setAddRole]     = useState("MEMBER");
  const [adding, setAdding]       = useState(false);
  const [addErr, setAddErr]       = useState("");
  const [saving, setSaving]       = useState<string | null>(null);
  const [removing, setRemoving]   = useState<string | null>(null);

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

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setAddErr(""); setAdding(true);
    try {
      const res = await fetch(`/api/super-admin/agencies/${agency.id}/members`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ email:addEmail, name:addName||undefined, password:addPw||undefined, role:addRole }),
      });
      const data = await res.json();
      if (!res.ok) { setAddErr(data.error ?? "שגיאה"); return; }
      setAddEmail(""); setAddName(""); setAddPw(""); setAddRole("MEMBER");
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
            {members.map(m => (
              <div key={m.userId} style={{ display:"flex", alignItems:"center", gap:10,
                padding:"8px 12px", background:"var(--surface-sunken)",
                borderRadius:"var(--r-md)", border:"1px solid var(--border-subtle)" }}>
                <div style={{ width:30, height:30, borderRadius:"50%", flexShrink:0,
                  background:"var(--accent-soft)", display:"grid", placeItems:"center",
                  fontSize:11, fontWeight:700, color:"var(--accent)" }}>
                  {(m.name || m.email)[0].toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {m.name ?? m.email}
                    {m.isSuperAdmin && (
                      <span style={{ marginInlineStart:6, fontSize:10, color:"var(--brand-cyan)",
                        background:"rgba(91,194,240,0.15)", borderRadius:4, padding:"1px 5px" }}>
                        SA
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", direction:"ltr" }}>{m.email}</div>
                </div>
                <select value={m.role}
                  onChange={e => changeRole(m.userId, e.target.value)}
                  disabled={saving === m.userId}
                  style={{ fontSize:12, padding:"3px 6px", borderRadius:"var(--r-sm)",
                    border:"1px solid var(--border)", background:"var(--surface)",
                    fontFamily:"inherit", cursor:"pointer" }}>
                  <option value="OWNER">בעלים</option>
                  <option value="ADMIN">מנהל</option>
                  <option value="MEMBER">חבר צוות</option>
                </select>
                {saving === m.userId && <Loader2 size={13} className="animate-spin" style={{ color:"var(--text-faint)" }}/>}
                <button onClick={() => removeMember(m.userId)} disabled={removing === m.userId}
                  style={{ background:"none", border:"none", cursor:"pointer",
                    color:"var(--red)", padding:4, flexShrink:0 }}>
                  {removing === m.userId ? <Loader2 size={13} className="animate-spin"/> : <X size={13}/>}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add member form */}
        <div style={{ borderTop:"1px solid var(--border)", paddingTop:14 }}>
          <p style={{ fontSize:12, fontWeight:600, marginBottom:10 }}>הוסף חבר</p>
          <form onSubmit={addMember} style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div className="field">
                <label className="field-label">אימייל *</label>
                <input className="rk-input" type="email" value={addEmail}
                  onChange={e=>setAddEmail(e.target.value)} dir="ltr" required
                  placeholder="user@example.com"/>
              </div>
              <div className="field">
                <label className="field-label">תפקיד</label>
                <select className="rk-input" value={addRole} onChange={e=>setAddRole(e.target.value)}
                  style={{ fontFamily:"inherit" }}>
                  <option value="OWNER">בעלים</option>
                  <option value="ADMIN">מנהל</option>
                  <option value="MEMBER">חבר צוות</option>
                </select>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div className="field">
                <label className="field-label">שם (משתמש חדש)</label>
                <input className="rk-input" value={addName} onChange={e=>setAddName(e.target.value)}
                  placeholder="ישראל ישראלי"/>
              </div>
              <div className="field">
                <label className="field-label">סיסמה (משתמש חדש)</label>
                <input className="rk-input" type="password" value={addPw}
                  onChange={e=>setAddPw(e.target.value)} dir="ltr" placeholder="מינימום 8 תווים"/>
              </div>
            </div>
            <Err msg={addErr}/>
            <button type="submit" disabled={adding || !addEmail} className="btn btn-primary sm"
              style={{ display:"inline-flex", alignItems:"center", gap:5, alignSelf:"start" }}>
              {adding ? <Loader2 size={12} className="animate-spin"/> : <UserPlus size={12}/>}
              הוסף לסוכנות
            </button>
          </form>
        </div>
      </div>
    </Modal>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers]     = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/super-admin/users");
      const d = await r.json();
      setUsers(d.users ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleSA(id: string, current: boolean) {
    setToggling(id);
    const res = await fetch(`/api/super-admin/users/${id}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ isSuperAdmin: !current }),
    });
    const data = await res.json();
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id===id ? {...u, isSuperAdmin: data.user.isSuperAdmin} : u));
    }
    setToggling(null);
  }

  if (loading) return (
    <div style={{ display:"flex", justifyContent:"center", padding:40 }}>
      <Loader2 size={22} className="animate-spin" style={{ color:"var(--text-faint)" }}/>
    </div>
  );

  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"var(--r-lg)", overflow:"hidden" }}>
      <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)",
        display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <h2 style={{ fontSize:14, fontWeight:700, margin:0 }}>
          משתמשי פלטפורמה ({users.length})
        </h2>
        <button onClick={load} className="btn btn-ghost sm"
          style={{ display:"inline-flex", alignItems:"center", gap:5 }}>
          <RefreshCw size={12}/> רענן
        </button>
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ background:"var(--surface-sunken)" }}>
              {["משתמש", "סוכנויות", "Super-admin", "נוצר"].map(h => (
                <th key={h} style={{ padding:"9px 16px", textAlign:"start", fontWeight:600,
                  color:"var(--text-muted)", borderBottom:"1px solid var(--border)", whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id}
                style={{ borderBottom: i < users.length-1 ? "1px solid var(--border-subtle)" : "none" }}>
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
                  <button
                    onClick={() => toggleSA(u.id, u.isSuperAdmin)}
                    disabled={toggling === u.id}
                    style={{ display:"inline-flex", alignItems:"center", gap:5,
                      background: u.isSuperAdmin ? "rgba(91,194,240,0.15)" : "var(--surface-sunken)",
                      color: u.isSuperAdmin ? "var(--brand-cyan)" : "var(--text-muted)",
                      border: `1px solid ${u.isSuperAdmin ? "rgba(91,194,240,0.3)" : "var(--border)"}`,
                      borderRadius:"var(--r-pill)", padding:"4px 10px", fontSize:11,
                      fontWeight:600, cursor:"pointer" }}>
                    {toggling === u.id
                      ? <Loader2 size={11} className="animate-spin"/>
                      : u.isSuperAdmin ? <ShieldCheck size={11}/> : <Shield size={11}/>}
                    {u.isSuperAdmin ? "Super-admin" : "רגיל"}
                  </button>
                </td>
                <td style={{ padding:"11px 16px", color:"var(--text-muted)", fontSize:12, whiteSpace:"nowrap" }}>
                  {new Date(u.createdAt).toLocaleDateString("he-IL")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SuperAdminClient({ initialStats }: { initialStats: Stats }) {
  const [activeTab, setActiveTab]     = useState<"agencies" | "users">("agencies");
  const [agencies, setAgencies]       = useState<Agency[]>([]);
  const [stats, setStats]             = useState<Stats>(initialStats);
  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [editAgency, setEditAgency]   = useState<Agency | null>(null);
  const [membersAgency, setMembersAgency] = useState<Agency | null>(null);
  const [deleting, setDeleting]       = useState<string | null>(null);

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

  async function deleteAgency(a: Agency) {
    if (!confirm(`למחוק את "${a.name}"? פעולה זו בלתי הפיכה — כל הלקוחות, הדוחות והחיבורים יימחקו.`)) return;
    setDeleting(a.id);
    await fetch(`/api/super-admin/agencies/${a.id}`, { method:"DELETE" });
    setAgencies(prev => prev.filter(ag => ag.id !== a.id));
    setDeleting(null);
  }

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding:"8px 18px", fontSize:13, fontWeight:600, cursor:"pointer",
    border:"none", background:"none",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    color: active ? "var(--accent)" : "var(--text-muted)",
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:28 }}>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14 }}>
        <StatCard icon={Building2} label="סוכנויות"      value={stats.agencyCount} color="#1E2D7D"/>
        <StatCard icon={Users}     label="משתמשים"      value={stats.userCount}   color="#5BC2F0"/>
        <StatCard icon={Globe}     label="לקוחות פעילים" value={stats.clientCount} color="#16a34a"/>
        <StatCard icon={FileText}  label="דוחות"         value={stats.reportCount} color="#f59e0b"/>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom:"1px solid var(--border)", display:"flex", gap:0 }}>
        <button onClick={() => setActiveTab("agencies")} style={TAB_STYLE(activeTab==="agencies")}>
          סוכנויות
        </button>
        <button onClick={() => setActiveTab("users")} style={TAB_STYLE(activeTab==="users")}>
          משתמשים
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
                      {["סוכנות", "בעלים", "חברים", "לקוחות", "דוחות", "Google", "תאריך", "פעולות"].map(h => (
                        <th key={h} style={{ padding:"9px 14px", textAlign:"start", fontWeight:600,
                          color:"var(--text-muted)", borderBottom:"1px solid var(--border)", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agencies.map((a, i) => (
                      <tr key={a.id}
                        style={{ borderBottom: i < agencies.length-1 ? "1px solid var(--border-subtle)" : "none" }}>
                        <td style={{ padding:"11px 14px" }}>
                          <div style={{ fontWeight:600 }}>{a.name}</div>
                          <div style={{ fontSize:11, color:"var(--text-faint)", fontFamily:"monospace" }}>{a.slug}</div>
                        </td>
                        <td style={{ padding:"11px 14px" }}>
                          {a.owner ? (
                            <div>
                              <div style={{ fontSize:12 }}>{a.owner.name ?? "—"}</div>
                              <div style={{ fontSize:11, color:"var(--text-muted)", direction:"ltr" }}>{a.owner.email}</div>
                            </div>
                          ) : <span style={{ color:"var(--text-faint)", fontSize:12 }}>—</span>}
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
                        <td style={{ padding:"11px 14px" }}>
                          <div style={{ display:"flex", gap:4, justifyContent:"flex-end" }}>
                            <button onClick={() => setMembersAgency(a)} title="ניהול חברים"
                              style={{ background:"none", border:"none", cursor:"pointer",
                                color:"var(--text-muted)", padding:5, borderRadius:"var(--r-sm)" }}>
                              <Users size={13}/>
                            </button>
                            <button onClick={() => setEditAgency(a)} title="עריכה"
                              style={{ background:"none", border:"none", cursor:"pointer",
                                color:"var(--text-muted)", padding:5, borderRadius:"var(--r-sm)" }}>
                              <Pencil size={13}/>
                            </button>
                            <button onClick={() => deleteAgency(a)} disabled={deleting === a.id}
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
