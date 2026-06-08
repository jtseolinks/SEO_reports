"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { HashMark } from "@/components/brand/hash-mark";
import { CheckCircle2, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "בעלים",
  ADMIN: "מנהל",
  MEMBER: "חבר צוות",
};

interface Props {
  token: string;
  agencyName: string;
  email: string;
  role: string;
  userExists: boolean;
}

export function AcceptForm({ token, agencyName, email, role, userExists }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleAccept() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: name || undefined,
          password: password || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "אירעה שגיאה");
        return;
      }

      if (!userExists && password) {
        const result = await signIn("credentials", { email, password, redirect: false });
        if (result?.ok) {
          router.push("/admin");
          return;
        }
      }

      setDone(true);
      setTimeout(() => router.push(`/login?email=${encodeURIComponent(email)}`), 2500);
    } catch {
      setError("אירעה שגיאת רשת");
    } finally {
      setLoading(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg)",
    padding: 16,
  };

  if (done) {
    return (
      <div style={cardStyle}>
        <div style={{
          width: "100%", maxWidth: 400, background: "var(--surface)",
          border: "1px solid var(--border)", borderRadius: "var(--r-xl)",
          boxShadow: "var(--shadow-lg)", padding: "40px 32px", textAlign: "center",
        }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--green-soft)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <CheckCircle2 size={28} style={{ color: "var(--green)" }} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
            ההזמנה אושרה!
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>מועבר/ת לדף הכניסה...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{
        width: "100%", maxWidth: 400, background: "var(--surface)",
        border: "1px solid var(--border)", borderRadius: "var(--r-xl)",
        boxShadow: "var(--shadow-lg)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(180deg, var(--brand-navy) 0%, var(--brand-navy-deep) 100%)",
          padding: "28px 32px 24px", textAlign: "center",
        }}>
          <div style={{
            display: "inline-grid", placeItems: "center",
            width: 44, height: 44, borderRadius: 12,
            background: "rgba(91,194,240,0.15)", marginBottom: 12,
          }}>
            <HashMark size={24} color="var(--brand-cyan)" />
          </div>
          <div style={{ color: "white", fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em" }}>
            Rankey
          </div>
          <div style={{ color: "#BFCDE8", fontSize: 13, marginTop: 2 }}>
            הזמנה להצטרף
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "28px 32px 32px" }}>
          {/* Invite info */}
          <div style={{
            background: "var(--accent-soft)", border: "1px solid var(--border)",
            borderRadius: "var(--r-md)", padding: "14px 16px", marginBottom: 24,
          }}>
            <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--text-muted)" }}>
              הוזמנת להצטרף ל
            </p>
            <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              {agencyName}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              תפקיד: <strong style={{ color: "var(--accent)" }}>{ROLE_LABELS[role] ?? role}</strong>
              {" · "}אימייל:{" "}
              <span dir="ltr" style={{ color: "var(--text)" }}>{email}</span>
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!userExists && (
              <>
                <div className="field">
                  <label className="field-label">שם מלא</label>
                  <input
                    className="rk-input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="ישראל ישראלי"
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label className="field-label">בחר סיסמה</label>
                  <div style={{ position: "relative" }}>
                    <input
                      className="rk-input"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      type={showPw ? "text" : "password"}
                      placeholder="לפחות 8 תווים"
                      dir="ltr"
                      style={{ paddingInlineEnd: 36 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(p => !p)}
                      style={{
                        position: "absolute", insetInlineEnd: 10, top: "50%",
                        transform: "translateY(-50%)", background: "none",
                        border: "none", cursor: "pointer",
                        color: "var(--text-faint)", display: "flex",
                      }}
                    >
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8, fontSize: 13,
                color: "var(--red)", background: "var(--red-soft)",
                border: "1px solid var(--red-soft-strong)",
                borderRadius: "var(--r-sm)", padding: "8px 12px",
              }}>
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              onClick={handleAccept}
              disabled={loading || (!userExists && (!name || !password))}
              className="btn btn-primary accent"
              style={{ width: "100%", justifyContent: "center", height: 40, fontSize: 14, marginTop: 4 }}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {userExists ? "קבל הזמנה" : "צור חשבון והצטרף"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
