"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { HashMark } from "@/components/brand/hash-mark";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("אימייל או סיסמה שגויים.");
      } else {
        router.push("/admin");
        router.refresh();
      }
    } catch {
      setError("אירעה שגיאה. אנא נסה שוב.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(180deg, var(--brand-navy) 0%, var(--brand-navy-deep) 100%)",
            padding: "28px 32px 24px",
            textAlign: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "inline-grid",
              placeItems: "center",
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(91,194,240,0.15)",
              marginBottom: 12,
            }}
          >
            <HashMark size={24} color="var(--brand-cyan)" />
          </div>
          <div style={{ color: "white", fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em" }}>
            Rankey
          </div>
          <div style={{ color: "#BFCDE8", fontSize: 13, marginTop: 2 }}>
            SEO Reports · Admin
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: "28px 32px 32px" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="field">
              <label className="field-label" htmlFor="email">אימייל</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                autoComplete="email"
                autoFocus
                className="rk-input"
                style={{ direction: "ltr", textAlign: "start" }}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="password">סיסמה</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="rk-input"
                style={{ direction: "ltr", textAlign: "start" }}
              />
            </div>

            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "var(--red)",
                  background: "var(--red-soft)",
                  border: "1px solid var(--red-soft-strong)",
                  borderRadius: "var(--r-sm)",
                  padding: "8px 12px",
                }}
              >
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary accent"
              style={{ width: "100%", justifyContent: "center", height: 40, fontSize: 14, marginTop: 4 }}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              כניסה למערכת
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
