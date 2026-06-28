"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { validatePassword } from "@/lib/password";

type Props = {
  token: string;
  agencyName: string;
  email: string;
  userName: string | null;
  isOwner: boolean;
};

const STEPS = [
  { id: "password",       label: "הגדרת סיסמא",      required: true  },
  { id: "agency-details", label: "פרטי הסוכנות",     required: false },
  { id: "google",         label: "חיבור Google",      required: false },
  { id: "team",           label: "חברי צוות",         required: false },
  { id: "smtp",           label: "הגדרות אימייל",     required: false },
];

export function OnboardClient({ token, agencyName, email, userName, isOwner }: Props) {
  const [step, setStep]         = useState(0);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [done, setDone]         = useState(false);

  // Step 1 - password
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPw,   setShowPw]   = useState(false);
  // Step 2 - agency details
  const [agencyDisplayName, setAgencyDisplayName] = useState(agencyName);
  // Step 5 - email sender (the "From" for reports sent to this agency's clients)
  const [senderEmail, setSenderEmail] = useState(email);
  const [senderName,  setSenderName]  = useState(agencyName);

  const totalSteps = STEPS.length;
  const progress   = ((step + 1) / (totalSteps + 1)) * 100; // +1 for complete step

  async function apiPost(body: Record<string, unknown>) {
    const res = await fetch(`/api/onboard/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "שגיאה");
    return json;
  }

  async function handlePasswordStep() {
    const pwErr = validatePassword(password);
    if (pwErr) { setError(pwErr); return; }
    if (password !== confirm) { setError("הסיסמאות אינן תואמות"); return; }
    setError(""); setLoading(true);
    try {
      await apiPost({ step: "password", password });
      if (!isOwner) {
        // Members skip the agency-setup steps - go straight to complete
        await apiPost({ step: "complete" });
        const result = await signIn("credentials", { email, password, redirect: false });
        if (result?.ok) {
          setDone(true);
          setTimeout(() => { window.location.href = "/admin"; }, 1500);
        } else {
          window.location.href = "/login";
        }
      } else {
        setStep(1);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  }

  async function handleAgencyDetailsStep() {
    setError(""); setLoading(true);
    try {
      await apiPost({ step: "agency-details", agencyDisplayName: agencyDisplayName.trim() });
      setStep(2);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    setError("");
    const fromEmail = senderEmail.trim();
    if (fromEmail && !fromEmail.includes("@")) { setError("כתובת שולח לא תקינה"); return; }
    setLoading(true);

    // Save the email sender (From) before completing - non-empty only.
    try {
      if (fromEmail) {
        await apiPost({ step: "email", emailSenderEmail: fromEmail, emailSenderName: senderName.trim() });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "שגיאה בשמירת הגדרות המייל");
      setLoading(false);
      return;
    }

    try {
      await apiPost({ step: "complete" });
      // Auto-login
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.ok) {
        setDone(true);
        setTimeout(() => { window.location.href = "/admin"; }, 1500);
      } else {
        window.location.href = "/login";
      }
    } catch {
      window.location.href = "/login";
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.card, textAlign: "center", padding: "60px 40px" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h2 style={{ margin: "0 0 8px", color: "#1E2D7D", fontSize: 24 }}>הגדרה הושלמה!</h2>
          <p style={{ color: "#6b7280", margin: "0 0 4px" }}>מועבר לאזור הניהול...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>#</div>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Rankey SEO Reports</span>
      </div>

      <div style={styles.container}>
        {/* Agency name banner */}
        <div style={styles.agencyBanner}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", display: "block", marginBottom: 4 }}>הגדרת חשבון סוכנות</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{agencyName}</span>
        </div>

        {/* Progress bar - owner only */}
        {isOwner && <div style={styles.progressWrap}>
          <div style={{ ...styles.progressBar, width: `${progress}%` }} />
        </div>}

        {/* Step indicators - owner only */}
        {isOwner && <div style={styles.steps}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={styles.stepItem}>
              <div style={{
                ...styles.stepDot,
                background: i < step ? "#00d4d4" : i === step ? "#1E2D7D" : "#e5e7eb",
                color: i < step ? "#1E2D7D" : i === step ? "#fff" : "#9ca3af",
                border: i === step ? "2px solid #1E2D7D" : "2px solid transparent",
              }}>
                {i < step ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 11, color: i <= step ? "#1E2D7D" : "#9ca3af", fontWeight: i === step ? 700 : 400 }}>
                {s.label}
                {s.required && <span style={{ color: "#ef4444", marginRight: 2 }}>*</span>}
              </span>
            </div>
          ))}
        </div>}

        {/* Card */}
        <div style={styles.card}>
          {error && <div style={styles.errorBox}>{error}</div>}

          {/* ─── Step 0: Password ─── */}
          {step === 0 && (
            <>
              <h2 style={styles.cardTitle}>
                {isOwner ? "הגדרת סיסמא" : `ברוך הבא ל-${agencyName}`}
              </h2>
              <p style={{ color: "#6b7280", fontSize: 13, marginTop: 0, marginBottom: 20 }}>
                {isOwner
                  ? <>סיסמא זו תשמש אותך לכניסה למערכת עם המייל <strong>{email}</strong></>
                  : <>הגדר סיסמא לחיבור לחשבון שלך עם <strong>{email}</strong></>
                }
              </p>
              <label style={styles.label}>סיסמא <span style={{ color: "#ef4444" }}>*</span></label>
              <div style={{ position: "relative" }}>
                <input
                  style={styles.input}
                  type={showPw ? "text" : "password"}
                  placeholder="8+ תווים, אות גדולה, קטנה וספרה"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handlePasswordStep()}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 13 }}
                >
                  {showPw ? "הסתר" : "הצג"}
                </button>
              </div>
              <label style={styles.label}>אימות סיסמא <span style={{ color: "#ef4444" }}>*</span></label>
              <input
                style={styles.input}
                type={showPw ? "text" : "password"}
                placeholder="הכנס שוב את הסיסמא"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handlePasswordStep()}
              />
              <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }} onClick={handlePasswordStep} disabled={loading}>
                {loading ? "שומר..." : "המשך ←"}
              </button>
            </>
          )}

          {/* ─── Step 1: Agency Details (skippable) ─── */}
          {step === 1 && (
            <>
              <h2 style={styles.cardTitle}>פרטי הסוכנות</h2>
              <p style={{ color: "#6b7280", fontSize: 13, marginTop: 0, marginBottom: 20 }}>
                ניתן לדלג ולהגדיר בהמשך בהגדרות
              </p>
              <label style={styles.label}>שם הסוכנות לתצוגה</label>
              <input
                style={styles.input}
                type="text"
                value={agencyDisplayName}
                onChange={e => setAgencyDisplayName(e.target.value)}
                placeholder="שם הסוכנות כפי שיופיע בדוחות"
              />
              <div style={styles.btnRow}>
                <button style={styles.btnSecondary} onClick={() => setStep(2)} disabled={loading}>דלג</button>
                <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }} onClick={handleAgencyDetailsStep} disabled={loading}>
                  {loading ? "שומר..." : "המשך ←"}
                </button>
              </div>
            </>
          )}

          {/* ─── Step 2: Google (skippable) ─── */}
          {step === 2 && (
            <>
              <h2 style={styles.cardTitle}>חיבור Google Search Console</h2>
              <p style={{ color: "#6b7280", fontSize: 13, marginTop: 0, marginBottom: 24 }}>
                הגדרה זו תאפשר לייבא נתוני SEO מ-Google Search Console ו-GA4.<br/>
                ניתן לדלג ולחבר מאוחר יותר בהגדרות.
              </p>
              <div style={styles.infoBox}>
                <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 14 }}>כיצד לחבר לאחר ההגדרה:</p>
                <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
                  לאחר הכניסה, עבור אל <strong>הגדרות → Google</strong> וחבר את חשבון Google שלך.
                  הדבר יאפשר ייבוא אוטומטי של נתוני Search Console ו-GA4 עבור כל לקוח.
                </p>
              </div>
              <button style={styles.btn} onClick={() => setStep(3)}>
                הבא ←
              </button>
            </>
          )}

          {/* ─── Step 3: Team (informational) ─── */}
          {step === 3 && (
            <>
              <h2 style={styles.cardTitle}>הוספת חברי צוות</h2>
              <p style={{ color: "#6b7280", fontSize: 13, marginTop: 0, marginBottom: 24 }}>
                הזמן עמיתים לצוות הסוכנות. ניתן לעשות זאת גם לאחר ההגדרה.
              </p>
              <div style={styles.infoBox}>
                <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 14 }}>ניהול חברי צוות</p>
                <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
                  לאחר הכניסה, עבור אל <strong>הגדרות → צוות</strong> כדי להזמין משתמשים חדשים עם תפקידים שונים.
                </p>
              </div>
              <button style={styles.btn} onClick={() => setStep(4)}>הבא ←</button>
            </>
          )}

          {/* ─── Step 4: Email sender (skippable) ─── */}
          {step === 4 && (
            <>
              <h2 style={styles.cardTitle}>הגדרות אימייל</h2>
              <p style={{ color: "#6b7280", fontSize: 13, marginTop: 0, marginBottom: 24 }}>
                בחר את הכתובת והשם שמהם יישלחו הדוחות ללקוחות שלך. ניתן לשנות בהמשך.
              </p>

              <label style={styles.label}>כתובת השולח (From)</label>
              <input
                style={styles.input}
                type="email"
                dir="ltr"
                value={senderEmail}
                onChange={e => setSenderEmail(e.target.value)}
                placeholder="reports@agency.co.il"
              />

              <label style={{ ...styles.label, marginTop: 16 }}>שם השולח</label>
              <input
                style={styles.input}
                value={senderName}
                onChange={e => setSenderName(e.target.value)}
                placeholder={agencyName}
              />

              <div style={{ ...styles.infoBox, marginTop: 18 }}>
                <p style={{ margin: 0, fontSize: 12.5, color: "#374151", lineHeight: 1.7 }}>
                  שרת הדואר מנוהל מרכזית - אין צורך להגדיר אותו. תבנית המייל, לוגו ונמענים
                  בעותק נסתר (BCC) זמינים אח״כ ב<strong>הגדרות → אימייל ושליחות</strong>.
                </p>
              </div>
              <button
                style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
                onClick={handleComplete}
                disabled={loading}
              >
                {loading ? "מסיים..." : "סיים הגדרה ועבור למערכת ←"}
              </button>
            </>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 16 }}>
          כניסה למערכת עם: <strong>{email}</strong>
        </p>
      </div>
    </div>
  );
}

// ─── Inline styles ────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f6f9",
    fontFamily: "Arial, sans-serif",
    direction: "rtl" as const,
  },
  header: {
    background: "#1E2D7D",
    padding: "16px 32px",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 36,
    height: 36,
    background: "#00d4d4",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 20,
    color: "#1E2D7D",
  },
  container: {
    maxWidth: 520,
    margin: "0 auto",
    padding: "32px 16px 48px",
  },
  agencyBanner: {
    background: "linear-gradient(135deg, #1E2D7D 0%, #2a3d9a 100%)",
    borderRadius: "12px 12px 0 0",
    padding: "20px 28px",
  },
  progressWrap: {
    height: 4,
    background: "#e5e7eb",
    borderRadius: 0,
  },
  progressBar: {
    height: "100%",
    background: "linear-gradient(to left, #00d4d4, #1E2D7D)",
    transition: "width 0.4s ease",
    borderRadius: 0,
  },
  steps: {
    display: "flex",
    background: "#fff",
    borderBottom: "1px solid #e5e7eb",
    padding: "12px 20px",
    gap: 0,
    justifyContent: "space-between" as const,
    overflowX: "auto" as const,
  },
  stepItem: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 4,
    flex: 1,
    minWidth: 60,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    transition: "all 0.3s",
  },
  card: {
    background: "#fff",
    borderRadius: "0 0 16px 16px",
    padding: "28px 32px 32px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  },
  cardTitle: {
    margin: "0 0 4px",
    fontSize: 20,
    fontWeight: 800,
    color: "#1E2D7D",
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    border: "1.5px solid #e5e7eb",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
    direction: "rtl" as const,
  },
  btn: {
    display: "block",
    width: "100%",
    padding: "12px",
    background: "#1E2D7D",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 20,
  },
  btnSecondary: {
    display: "block",
    flex: 1,
    padding: "12px",
    background: "#f3f4f6",
    color: "#374151",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 20,
  },
  btnGhost: {
    display: "block",
    width: "100%",
    padding: "10px",
    background: "transparent",
    color: "#9ca3af",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    cursor: "pointer",
  },
  btnRow: {
    display: "flex",
    gap: 10,
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#dc2626",
    marginBottom: 16,
  },
  infoBox: {
    background: "#f8faff",
    border: "1px solid #e0e7ff",
    borderRadius: 10,
    padding: "16px 20px",
    marginBottom: 8,
  },
};
