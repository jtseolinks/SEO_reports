"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { validatePassword } from "@/lib/password";

export function RegisterForm() {
  const router = useRouter();
  const [agencyName, setAgencyName] = useState("");
  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const pwErr = validatePassword(password);
    if (pwErr) { setError(pwErr); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyName, name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "שגיאה ביצירת החשבון"); return; }

      // Auto-login after registration.
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        // Fallback: redirect to login manually.
        router.push("/login?registered=1");
        return;
      }
      setDone(true);
      setTimeout(() => { router.push("/admin"); router.refresh(); }, 1200);
    } catch {
      setError("אירעה שגיאה. אנא נסה שוב.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div style={{ padding: "40px 32px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <CheckCircle2 size={40} style={{ color: "var(--green, #22c55e)" }} />
        <div style={{ fontWeight: 700, fontSize: 17 }}>הסוכנות נוצרה בהצלחה!</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>מעביר לממשק הניהול...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 32px 32px" }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>

        <div className="field">
          <label className="field-label" htmlFor="agencyName">שם הסוכנות *</label>
          <input
            id="agencyName" className="rk-input"
            value={agencyName} onChange={e => setAgencyName(e.target.value)}
            placeholder="Rankey SEO" required autoFocus
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="fullName">שם מלא</label>
          <input
            id="fullName" className="rk-input"
            value={name} onChange={e => setName(e.target.value)}
            placeholder="ישראל ישראלי"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="email">אימייל *</label>
          <input
            id="email" type="email" className="rk-input"
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@agency.co.il" required
            autoComplete="email"
            style={{ direction: "ltr", textAlign: "start" }}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="password">סיסמה *</label>
          <div style={{ position: "relative" }}>
            <input
              id="password"
              type={showPw ? "text" : "password"}
              className="rk-input"
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="8+ תווים, אות גדולה, קטנה וספרה" required
              autoComplete="new-password"
              style={{ direction: "ltr", textAlign: "start", paddingInlineEnd: 36 }}
            />
            <button
              type="button"
              onClick={() => setShowPw(p => !p)}
              style={{
                position: "absolute", top: "50%", insetInlineEnd: 10,
                transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-faint)", padding: 2,
              }}
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>לפחות 8 תווים, כולל אות גדולה, אות קטנה וספרה</p>
        </div>

        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, fontSize: 13,
            color: "var(--red)", background: "var(--red-soft)",
            border: "1px solid var(--red-soft-strong)",
            borderRadius: "var(--r-sm)", padding: "8px 12px",
          }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <button
          type="submit" disabled={loading}
          className="btn btn-primary accent"
          style={{ width: "100%", justifyContent: "center", height: 40, fontSize: 14, marginTop: 2 }}
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          צור סוכנות
        </button>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          כבר יש לך חשבון?{" "}
          <a href="/login" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
            כניסה למערכת
          </a>
        </p>
      </form>
    </div>
  );
}
