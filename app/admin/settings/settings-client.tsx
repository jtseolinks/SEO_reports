"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Sparkles, Mail, Calendar, Users,
  Upload, Trash2, CheckCircle2, AlertCircle, Loader2,
  Plus, X, Eye, EyeOff, Shield, Pencil, Check, Code2,
} from "lucide-react";
import type { AgencySettings } from "@/lib/agency-settings";

// ── Section definitions ───────────────────────────────────────────────────────

const SECTIONS = [
  { id: "agency",    label: "פרטי הסוכנות",    icon: Building2 },
  { id: "branding",  label: "מיתוג דוחות",      icon: Sparkles  },
  { id: "email",     label: "אימייל ושליחות",   icon: Mail      },
  { id: "schedule",  label: "תזמון ברירת מחדל", icon: Calendar  },
  { id: "team",      label: "צוות והרשאות",      icon: Users     },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

// ── Shared save-result footer ─────────────────────────────────────────────────

function SaveRow({ dirty, saving, saveResult, onSave, onReset }: {
  dirty: boolean; saving: boolean; saveResult: "ok" | "err" | null;
  onSave: () => void; onReset: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
      <button onClick={onSave} disabled={saving || !dirty} className="btn btn-primary"
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {saving ? <Loader2 size={13} className="animate-spin" /> : null}
        שמור שינויים
      </button>
      {dirty && <button onClick={onReset} className="btn btn-secondary">ביטול</button>}
      {saveResult === "ok" && (
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--green)" }}>
          <CheckCircle2 size={14} /> נשמר בהצלחה
        </span>
      )}
      {saveResult === "err" && (
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--red)" }}>
          <AlertCircle size={14} /> שגיאה בשמירה
        </span>
      )}
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
        background: value ? "var(--accent, #1E2D7D)" : "var(--border-strong)",
        position: "relative", flexShrink: 0, transition: "background 0.2s",
      }}
    >
      <span style={{
        position: "absolute", top: 3,
        insetInlineStart: value ? "calc(100% - 19px)" : 3,
        width: 16, height: 16, borderRadius: "50%",
        background: "#fff", transition: "inset-inline-start 0.2s",
      }} />
    </button>
  );
}

// ── AgencyAvatar ──────────────────────────────────────────────────────────────

function AgencyAvatar({ name, logoUrl, size = 72 }: { name: string; logoUrl: string; size?: number }) {
  if (logoUrl) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 12, flexShrink: 0,
        background: "#e5e7eb", display: "grid", placeItems: "center",
        padding: 6, boxSizing: "border-box",
      }}>
        <img src={logoUrl} alt="לוגו"
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
      </div>
    );
  }
  const initial = name.trim()[0]?.toUpperCase() ?? "A";
  return (
    <div style={{
      width: size, height: size, borderRadius: 12, flexShrink: 0,
      background: "#1E2D7D", color: "#fff",
      display: "grid", placeItems: "center",
      fontSize: size * 0.42, fontWeight: 800, letterSpacing: "-0.02em",
    }}>
      {initial}
    </div>
  );
}

// ── Shared props type ─────────────────────────────────────────────────────────

interface SectionProps {
  form: AgencySettings;
  initialSettings: AgencySettings;
  dirty: boolean;
  saving: boolean;
  saveResult: "ok" | "err" | null;
  updateField: <K extends keyof AgencySettings>(key: K, value: AgencySettings[K]) => void;
  handleSave: () => Promise<void>;
  resetForm: () => void;
}

// ── 1. Agency section ─────────────────────────────────────────────────────────

interface AgencySectionProps extends SectionProps {
  logoUploading: boolean;
  logoInputRef: React.RefObject<HTMLInputElement | null>;
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleRemoveLogo: () => void;
}

function AgencySection({
  form, initialSettings, dirty, saving, saveResult,
  logoUploading, logoInputRef,
  updateField, handleSave, resetForm, handleLogoUpload, handleRemoveLogo,
}: AgencySectionProps) {
  return (
    <>
      <div className="card">
        <div className="card-head">
          <div>
            <h3 className="card-title">פרטי הסוכנות</h3>
            <p className="card-sub">מופיע בכל הדוחות הנשלחים ללקוחות</p>
          </div>
        </div>
        <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="field-label">שם הסוכנות</label>
              <input className="rk-input" value={form.agencyName}
                onChange={e => updateField("agencyName", e.target.value)} placeholder="Rankey#" />
            </div>
            <div>
              <label className="field-label">URL ציבורי</label>
              <input className="rk-input" value={form.agencyUrl} dir="ltr"
                onChange={e => updateField("agencyUrl", e.target.value)} placeholder="rankey.co.il" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="field-label">איש קשר ראשי</label>
              <input className="rk-input" value={form.contactName}
                onChange={e => updateField("contactName", e.target.value)} placeholder="ישראל ישראלי" />
            </div>
            <div>
              <label className="field-label">אימייל ראשי</label>
              <input className="rk-input" value={form.contactEmail} dir="ltr"
                onChange={e => updateField("contactEmail", e.target.value)} placeholder="info@agency.co.il" />
            </div>
          </div>
          <div>
            <label className="field-label">תיאור הסוכנות</label>
            <textarea className="rk-input" value={form.description} rows={3}
              onChange={e => updateField("description", e.target.value)}
              placeholder="תיאור קצר — יופיע בפתח הדוח ובחתימת המייל"
              style={{ resize: "vertical" }} />
          </div>
          <SaveRow dirty={dirty} saving={saving} saveResult={saveResult} onSave={handleSave} onReset={resetForm} />
        </div>
      </div>

      {/* Logo */}
      <div className="card">
        <div className="card-head"><h3 className="card-title">לוגו הסוכנות</h3></div>
        <div className="card-pad">
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <AgencyAvatar name={form.agencyName || "A"} logoUrl={form.logoUrl} size={72} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>גרור קובץ או לחץ להעלאה</p>
              <p style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 14 }}>PNG או SVG, מומלץ 512×512, רקע שקוף</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
                  className="btn btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  {logoUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  העלאת לוגו
                </button>
                {form.logoUrl && (
                  <button onClick={handleRemoveLogo} className="iconbtn" title="הסר לוגו" style={{ color: "var(--red)" }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
          <input ref={logoInputRef} type="file" accept="image/png,image/svg+xml,image/jpeg"
            style={{ display: "none" }} onChange={handleLogoUpload} />
          {dirty && form.logoUrl !== initialSettings.logoUrl && (
            <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary"
                style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : null} שמור לוגו
              </button>
              <button onClick={resetForm} className="btn btn-secondary" style={{ fontSize: 13 }}>ביטול</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── 2. Branding section ───────────────────────────────────────────────────────

function BrandingSection({ form, dirty, saving, saveResult, updateField, handleSave, resetForm }: SectionProps) {
  return (
    <>
      <div className="card">
        <div className="card-head">
          <div>
            <h3 className="card-title">צבעי הדוח</h3>
            <p className="card-sub">צבעים המשמשים לכותרות, גבולות וגרפים בדוחות PDF</p>
          </div>
        </div>
        <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="field-label">צבע ראשי</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <input
                  type="color"
                  value={form.reportPrimaryColor || "#1E2D7D"}
                  onChange={e => updateField("reportPrimaryColor", e.target.value)}
                  style={{ width: 44, height: 36, padding: 2, border: "1px solid var(--border)", borderRadius: "var(--r-sm)", cursor: "pointer", background: "var(--surface)" }}
                />
                <input
                  className="rk-input"
                  value={form.reportPrimaryColor}
                  onChange={e => updateField("reportPrimaryColor", e.target.value)}
                  placeholder="#1E2D7D"
                  dir="ltr"
                  style={{ fontFamily: "monospace", fontSize: 13 }}
                />
              </div>
            </div>
            <div>
              <label className="field-label">צבע משני</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <input
                  type="color"
                  value={form.reportAccentColor || "#1E6FBF"}
                  onChange={e => updateField("reportAccentColor", e.target.value)}
                  style={{ width: 44, height: 36, padding: 2, border: "1px solid var(--border)", borderRadius: "var(--r-sm)", cursor: "pointer", background: "var(--surface)" }}
                />
                <input
                  className="rk-input"
                  value={form.reportAccentColor}
                  onChange={e => updateField("reportAccentColor", e.target.value)}
                  placeholder="#1E6FBF"
                  dir="ltr"
                  style={{ fontFamily: "monospace", fontSize: 13 }}
                />
              </div>
            </div>
          </div>

          {/* Preview strip */}
          <div style={{ borderRadius: "var(--r-md)", overflow: "hidden", border: "1px solid var(--border)" }}>
            <div style={{
              background: form.reportPrimaryColor || "#1E2D7D",
              padding: "14px 20px", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>דוח חודשי SEO</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{form.agencyName || "Rankey#"}</div>
              </div>
              {form.logoUrl
                ? <img src={form.logoUrl} alt="" style={{ height: 36, borderRadius: 6, objectFit: "contain" }} />
                : <div style={{ width: 36, height: 36, borderRadius: 6, background: "rgba(255,255,255,0.2)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13 }}>R</div>}
            </div>
            <div style={{ background: "var(--surface)", padding: "10px 20px", display: "flex", gap: 16 }}>
              {["קליקים", "חשיפות", "מיקום"].map((label, i) => (
                <div key={label}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: form.reportAccentColor || "#1E6FBF" }}>
                    {["1.2K", "45K", "3.4"][i]}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          <SaveRow dirty={dirty} saving={saving} saveResult={saveResult} onSave={handleSave} onReset={resetForm} />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3 className="card-title">טקסט תחתית הדוח</h3>
            <p className="card-sub">שורת Footer שמופיעה בתחתית כל עמוד בדוח</p>
          </div>
        </div>
        <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="field-label">טקסט Footer</label>
            <input
              className="rk-input"
              value={form.reportFooterText}
              onChange={e => updateField("reportFooterText", e.target.value)}
              placeholder={`© ${new Date().getFullYear()} ${form.agencyName || "הסוכנות שלי"} — כל הזכויות שמורות`}
            />
            <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 5 }}>
              השאר ריק כדי להשתמש בברירת המחדל
            </p>
          </div>
          <SaveRow dirty={dirty} saving={saving} saveResult={saveResult} onSave={handleSave} onReset={resetForm} />
        </div>
      </div>
    </>
  );
}

// ── HTML email default template ───────────────────────────────────────────────

const DEFAULT_HTML_TEMPLATE = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>דוח SEO חודשי</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1E2D7D;padding:32px 40px;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:6px;">דוח חודשי • {agency}</p>
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;">{client}</h1>
            <p style="margin:6px 0 0;font-size:15px;color:rgba(255,255,255,0.8);">{month}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">שלום,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">{introText}</p>

            <div style="background:#f0f4ff;border-right:4px solid #1E2D7D;border-radius:6px;padding:16px 20px;margin-bottom:28px;">
              <p style="margin:0;font-size:13px;color:#1E2D7D;font-weight:600;">הדוח מצורף כקובץ PDF למייל זה</p>
              <p style="margin:4px 0 0;font-size:12px;color:#6B7280;">ניתן לפתוח ישירות מתוך תיבת הדואר</p>
            </div>

            <p style="margin:0;font-size:15px;color:#374151;line-height:1.7;">בברכה,<br/><strong>{agency}</strong></p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;text-align:center;">
              מייל זה נשלח אוטומטית על ידי מערכת Rankey SEO Reports
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ── 3. Email section ──────────────────────────────────────────────────────────

function EmailSection({ form, dirty, saving, saveResult, updateField, handleSave, resetForm }: SectionProps) {
  const [testTo, setTestTo]       = useState("");
  const [testing, setTesting]     = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [htmlPreview, setHtmlPreview] = useState(false);

  const smtpConfigured = !!(form.smtpHost && form.smtpUser && form.smtpPass);

  function previewHtml(): string {
    const tpl = form.emailHtmlTemplate || DEFAULT_HTML_TEMPLATE;
    return tpl
      .replace(/\{client\}/g, "לקוח לדוגמה")
      .replace(/\{month\}/g, "מאי 2026")
      .replace(/\{agency\}/g, form.agencyName || form.emailSenderName || "Rankey SEO")
      .replace(/\{introText\}/g, form.emailIntroText || "מצורף דוח ה-SEO החודשי עבור האתר שלכם.")
      .replace(/\{logoUrl\}/g, form.logoUrl || "");
  }

  async function handleTest() {
    if (!testTo) return;
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch("/api/reports/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      const data = await res.json();
      setTestResult(res.ok ? { ok: true, msg: "מייל נשלח בהצלחה!" } : { ok: false, msg: data.error ?? "שגיאה בשליחה" });
    } catch {
      setTestResult({ ok: false, msg: "שגיאת רשת" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      {/* SMTP configuration */}
      <div className="card">
        <div className="card-head">
          <div>
            <h3 className="card-title">הגדרות SMTP</h3>
            <p className="card-sub">שרת דואר יוצא לשליחת דוחות. מומלץ: <strong>Brevo</strong> (300 מיילים/יום חינם)</p>
          </div>
          <span className={`rk-badge ${smtpConfigured ? "success" : "neutral"}`} style={{ fontSize: 10, alignSelf: "center" }}>
            <span className="pip" />{smtpConfigured ? "מוגדר" : "לא מוגדר"}
          </span>
        </div>
        <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
            <div>
              <label className="field-label">שרת SMTP (Host)</label>
              <input className="rk-input" value={form.smtpHost} dir="ltr"
                onChange={e => updateField("smtpHost", e.target.value)}
                placeholder="smtp-relay.brevo.com" />
            </div>
            <div style={{ minWidth: 90 }}>
              <label className="field-label">פורט</label>
              <input className="rk-input" value={form.smtpPort} dir="ltr"
                onChange={e => updateField("smtpPort", e.target.value)}
                placeholder="587" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="field-label">שם משתמש</label>
              <input className="rk-input" value={form.smtpUser} dir="ltr"
                onChange={e => updateField("smtpUser", e.target.value)}
                placeholder="your@email.com" />
            </div>
            <div>
              <label className="field-label">סיסמה / API Key</label>
              <input className="rk-input" value={form.smtpPass} dir="ltr" type="password"
                onChange={e => updateField("smtpPass", e.target.value)}
                placeholder="••••••••" />
            </div>
          </div>

          <div style={{ background: "var(--surface-sunken)", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            <strong>Brevo (חינמי):</strong> smtp-relay.brevo.com · פורט 587 · שם משתמש = האימייל שלך ב-Brevo · סיסמה = SMTP key מ-<span dir="ltr">Settings → SMTP & API</span>
          </div>

          <SaveRow dirty={dirty} saving={saving} saveResult={saveResult} onSave={handleSave} onReset={resetForm} />

          {/* Test send */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label className="field-label">בדוק שליחה — שלח מייל ניסיון</label>
              <input className="rk-input" value={testTo} dir="ltr" type="email"
                onChange={e => setTestTo(e.target.value)}
                placeholder="your@email.com"
                onKeyDown={e => { if (e.key === "Enter") handleTest(); }} />
            </div>
            <button onClick={handleTest} disabled={testing || !testTo || !smtpConfigured}
              className="btn btn-secondary sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
              {testing ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
              שלח בדיקה
            </button>
          </div>
          {testResult && (
            <div style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5, color: testResult.ok ? "var(--green)" : "var(--red)" }}>
              {testResult.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              {testResult.msg}
            </div>
          )}
        </div>
      </div>

      {/* Sender settings */}
      <div className="card">
        <div className="card-head">
          <div>
            <h3 className="card-title">הגדרות שולח</h3>
            <p className="card-sub">פרטי ה-From שיופיעו בכל מייל נשלח</p>
          </div>
        </div>
        <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="field-label">שם השולח</label>
              <input className="rk-input" value={form.emailSenderName}
                onChange={e => updateField("emailSenderName", e.target.value)}
                placeholder={form.agencyName || "Rankey SEO"} />
            </div>
            <div>
              <label className="field-label">כתובת השולח (From)</label>
              <input className="rk-input" value={form.emailSenderEmail} dir="ltr"
                onChange={e => updateField("emailSenderEmail", e.target.value)}
                placeholder={form.contactEmail || "reports@agency.co.il"} />
            </div>
          </div>

          <div>
            <label className="field-label">נושא המייל</label>
            <input className="rk-input" value={form.emailSubjectTemplate}
              onChange={e => updateField("emailSubjectTemplate", e.target.value)}
              placeholder="דוח SEO חודשי – {client} – {month}" />
            <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 5 }}>
              משתנים זמינים: <code style={{ background: "var(--surface-sunken)", padding: "1px 5px", borderRadius: 4 }}>{"{client}"}</code> שם הלקוח,{" "}
              <code style={{ background: "var(--surface-sunken)", padding: "1px 5px", borderRadius: 4 }}>{"{month}"}</code> חודש הדוח
            </p>
          </div>

          {/* HTML email template */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                  <Code2 size={14} style={{ color: "var(--accent)" }} />
                  <span className="field-label" style={{ marginBottom: 0 }}>תבנית HTML למייל</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-faint)", margin: 0 }}>
                  עיצוב מלא של המייל. ריק = תבנית ברירת מחדל פשוטה.
                  משתנים: <code style={{ background: "var(--surface-sunken)", padding: "1px 4px", borderRadius: 3 }}>{"{client}"}</code>{" "}
                  <code style={{ background: "var(--surface-sunken)", padding: "1px 4px", borderRadius: 3 }}>{"{month}"}</code>{" "}
                  <code style={{ background: "var(--surface-sunken)", padding: "1px 4px", borderRadius: 3 }}>{"{agency}"}</code>{" "}
                  <code style={{ background: "var(--surface-sunken)", padding: "1px 4px", borderRadius: 3 }}>{"{introText}"}</code>
                </p>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setHtmlPreview(p => !p)}
                  className="btn btn-ghost sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                >
                  {htmlPreview ? <EyeOff size={12} /> : <Eye size={12} />}
                  {htmlPreview ? "עורך" : "תצוגה מקדימה"}
                </button>
                {!form.emailHtmlTemplate && (
                  <button
                    type="button"
                    onClick={() => updateField("emailHtmlTemplate", DEFAULT_HTML_TEMPLATE)}
                    className="btn btn-secondary sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                  >
                    <Sparkles size={12} /> הכנס תבנית ברירת מחדל
                  </button>
                )}
                {form.emailHtmlTemplate && (
                  <button
                    type="button"
                    onClick={() => { if (window.confirm("לאפס את התבנית?")) updateField("emailHtmlTemplate", ""); }}
                    className="btn btn-ghost sm"
                    style={{ color: "var(--red)" }}
                  >
                    <Trash2 size={12} /> אפס
                  </button>
                )}
              </div>
            </div>

            {htmlPreview ? (
              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden", height: 420 }}>
                <iframe
                  srcDoc={previewHtml()}
                  style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                  title="תצוגה מקדימה של המייל"
                  sandbox="allow-same-origin"
                />
              </div>
            ) : (
              <textarea
                className="rk-input"
                value={form.emailHtmlTemplate}
                onChange={e => updateField("emailHtmlTemplate", e.target.value)}
                rows={18}
                placeholder={`השאר ריק לשימוש בתבנית ברירת המחדל, או הכנס HTML מותאם אישית...\n\nלחץ "הכנס תבנית ברירת מחדל" כנקודת התחלה.`}
                dir="ltr"
                spellCheck={false}
                style={{
                  resize: "vertical",
                  fontFamily: "'Courier New', Courier, monospace",
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  tabSize: 2,
                }}
              />
            )}
          </div>

          {/* Agency BCC */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <div className="field-label" style={{ marginBottom: 2 }}>BCC לסוכנות (בקרה)</div>
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                  כתובת שתקבל עותק מוסתר של כל דוח שנשלח
                </div>
              </div>
              <button
                onClick={() => updateField("agencyBccEnabled", form.agencyBccEnabled === "true" ? "false" : "true")}
                style={{
                  width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", flexShrink: 0,
                  background: form.agencyBccEnabled === "true" ? "var(--accent)" : "var(--border-strong)",
                  position: "relative", transition: "background 0.2s",
                }}
                title={form.agencyBccEnabled === "true" ? "כבה BCC" : "הפעל BCC"}
              >
                <span style={{
                  position: "absolute", top: 3, width: 16, height: 16, borderRadius: "50%",
                  background: "#fff", transition: "inset-inline-start 0.2s",
                  insetInlineStart: form.agencyBccEnabled === "true" ? 20 : 4,
                }} />
              </button>
            </div>
            <input
              className="rk-input"
              value={form.agencyBccEmail}
              onChange={e => updateField("agencyBccEmail", e.target.value)}
              type="email" dir="ltr"
              placeholder="jtseolinks@gmail.com"
              disabled={form.agencyBccEnabled !== "true"}
              style={{ opacity: form.agencyBccEnabled === "true" ? 1 : 0.45 }}
            />
          </div>

          <SaveRow dirty={dirty} saving={saving} saveResult={saveResult} onSave={handleSave} onReset={resetForm} />
        </div>
      </div>
    </>
  );
}

// ── 4. Schedule section ───────────────────────────────────────────────────────

function ScheduleSection({ form, dirty, saving, saveResult, updateField, handleSave, resetForm }: SectionProps) {
  const day = parseInt(form.defaultSendDay || "5", 10);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3 className="card-title">ברירות מחדל ללקוחות חדשים</h3>
          <p className="card-sub">ערכים אלה יוגדרו אוטומטית בעת הוספת לקוח חדש</p>
        </div>
      </div>
      <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Send day */}
        <div>
          <label className="field-label">יום שליחת הדוח בחודש</label>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
            <input
              type="range" min={1} max={28} value={day}
              onChange={e => updateField("defaultSendDay", e.target.value)}
              style={{ flex: 1, accentColor: "var(--accent)" }}
            />
            <div style={{
              minWidth: 48, textAlign: "center", fontWeight: 700, fontSize: 18,
              color: "var(--accent)", background: "var(--accent-soft)",
              borderRadius: "var(--r-sm)", padding: "4px 10px",
            }}>
              {day}
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 6 }}>
            הדוח יישלח ביום {day} לכל חודש, בשעה 09:00
          </p>
        </div>

        {/* Language */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>שפת דוח ברירת מחדל</div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>שפה לדוחות PDF חדשים</div>
          </div>
          <select
            value={form.defaultLanguage || "he"}
            onChange={e => updateField("defaultLanguage", e.target.value)}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "6px 12px", fontSize: 13, fontFamily: "inherit", color: "var(--text)", outline: "none", cursor: "pointer" }}
          >
            <option value="he">עברית 🇮🇱</option>
            <option value="en">English 🇬🇧</option>
          </select>
        </div>

        {/* Auto-send */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>שליחה אוטומטית ברירת מחדל</div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
              {form.defaultAutoSend === "true" ? "לקוחות חדשים יקבלו שליחה אוטומטית מופעלת" : "שליחה אוטומטית מושבתת כברירת מחדל"}
            </div>
          </div>
          <Toggle
            value={form.defaultAutoSend === "true"}
            onChange={v => updateField("defaultAutoSend", v ? "true" : "false")}
          />
        </div>

        <SaveRow dirty={dirty} saving={saving} saveResult={saveResult} onSave={handleSave} onReset={resetForm} />
      </div>
    </div>
  );
}

// ── 5. Team section ───────────────────────────────────────────────────────────

type TeamUser = { id: string; email: string; name: string | null; role: string; createdAt: string };

function TeamSection() {
  const [users, setUsers]       = useState<TeamUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [addOpen, setAddOpen]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [newName, setNewName]       = useState("");
  const [newEmail, setNewEmail]     = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [adding, setAdding]         = useState(false);
  const [addErr, setAddErr]         = useState("");

  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editName, setEditName]     = useState("");
  const [editEmail, setEditEmail]   = useState("");
  const [editRole, setEditRole]     = useState("ADMIN");
  const [editErr, setEditErr]       = useState("");
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    fetch("/api/settings/users")
      .then(r => r.json())
      .then(d => { setUsers(d.users ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function addUser() {
    if (!newEmail || !newPassword) { setAddErr("אימייל וסיסמה נדרשים"); return; }
    setAdding(true); setAddErr("");
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: "ADMIN" }),
      });
      const data = await res.json();
      if (!res.ok) { setAddErr(data.error ?? "שגיאה"); return; }
      setUsers(prev => [...prev, data.user]);
      setNewName(""); setNewEmail(""); setNewPassword(""); setAddOpen(false);
    } finally {
      setAdding(false);
    }
  }

  async function removeUser(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/settings/users/${id}`, { method: "DELETE" });
      if (res.ok) setUsers(prev => prev.filter(u => u.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  function startEdit(u: TeamUser) {
    setEditingId(u.id);
    setEditName(u.name ?? "");
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditErr("");
  }

  async function saveEdit(id: string) {
    if (!editEmail) { setEditErr("אימייל נדרש"); return; }
    setSaving(true); setEditErr("");
    try {
      const res = await fetch(`/api/settings/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, email: editEmail, role: editRole }),
      });
      const data = await res.json();
      if (!res.ok) { setEditErr(data.error ?? "שגיאה"); return; }
      setUsers(prev => prev.map(u => u.id === id ? data.user : u));
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  const roleLabel = (role: string) => role === "ADMIN" ? "מנהל" : role;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3 className="card-title">צוות הסוכנות</h3>
          <p className="card-sub">משתמשים עם גישה לממשק הניהול</p>
        </div>
        <button onClick={() => { setAddOpen(o => !o); setAddErr(""); }} className="btn btn-secondary sm"
          style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Plus size={13} /> הוסף משתמש
        </button>
      </div>

      {/* Add user form */}
      {addOpen && (
        <div style={{ margin: "0 20px 16px", padding: "16px", background: "var(--surface-sunken)", borderRadius: "var(--r-md)", border: "1px solid var(--border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label className="field-label">שם</label>
              <input className="rk-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="ישראל ישראלי" />
            </div>
            <div>
              <label className="field-label">אימייל</label>
              <input className="rk-input" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder="user@agency.co.il" dir="ltr" type="email" />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="field-label">סיסמה</label>
            <div style={{ position: "relative" }}>
              <input className="rk-input" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                type={showPw ? "text" : "password"} placeholder="לפחות 8 תווים" dir="ltr"
                style={{ paddingInlineEnd: 36 }} />
              <button onClick={() => setShowPw(p => !p)} style={{ position: "absolute", insetInlineEnd: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", display: "flex" }}>
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          {addErr && <p style={{ fontSize: 12, color: "var(--red)", marginBottom: 10 }}>{addErr}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addUser} disabled={adding} className="btn btn-primary sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} הוסף
            </button>
            <button onClick={() => { setAddOpen(false); setAddErr(""); }} className="btn btn-ghost sm">ביטול</button>
          </div>
        </div>
      )}

      {/* Users list */}
      {loading ? (
        <div style={{ padding: "24px", textAlign: "center" }}>
          <Loader2 size={18} className="animate-spin" style={{ color: "var(--text-faint)" }} />
        </div>
      ) : users.length === 0 ? (
        <div style={{ padding: "24px", textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>
          אין משתמשים עדיין
        </div>
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>שם</th>
                <th>אימייל</th>
                <th>תפקיד</th>
                <th>נוסף</th>
                <th style={{ textAlign: "end" }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isEditing = editingId === u.id;
                return (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>
                      {isEditing ? (
                        <input className="rk-input" value={editName} onChange={e => setEditName(e.target.value)}
                          placeholder="שם המשתמש" style={{ fontSize: 13, padding: "4px 8px", minWidth: 120 }}
                          onKeyDown={e => { if (e.key === "Enter") saveEdit(u.id); if (e.key === "Escape") setEditingId(null); }}
                          autoFocus />
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent-soft)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}>
                            {(u.name || u.email)[0].toUpperCase()}
                          </div>
                          {u.name || "—"}
                        </div>
                      )}
                    </td>
                    <td dir="ltr">
                      {isEditing ? (
                        <input className="rk-input" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                          type="email" dir="ltr" placeholder="user@agency.co.il"
                          style={{ fontSize: 13, padding: "4px 8px", minWidth: 160 }} />
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{u.email}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select className="rk-input" value={editRole} onChange={e => setEditRole(e.target.value)}
                          style={{ fontSize: 12, padding: "4px 8px" }}>
                          <option value="ADMIN">מנהל</option>
                          <option value="VIEWER">צופה</option>
                        </select>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, background: "var(--accent-soft)", color: "var(--accent)", borderRadius: "var(--r-pill)", padding: "2px 8px" }}>
                          <Shield size={10} /> {roleLabel(u.role)}
                        </span>
                      )}
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: 12.5 }}>
                      {isEditing && editErr ? (
                        <span style={{ fontSize: 11, color: "var(--red)" }}>{editErr}</span>
                      ) : (
                        new Date(u.createdAt).toLocaleDateString("he-IL")
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(u.id)} disabled={saving}
                              className="iconbtn" title="שמור" style={{ color: "var(--green)" }}>
                              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                            </button>
                            <button onClick={() => setEditingId(null)} className="iconbtn" title="ביטול">
                              <X size={13} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(u)} className="iconbtn" title="עריכה">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => removeUser(u.id)} disabled={deleting === u.id}
                              className="iconbtn" title="מחק משתמש" style={{ color: "var(--red)" }}>
                              {deleting === u.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SettingsClient({ initialSettings }: { initialSettings: AgencySettings }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [activeSection, setActiveSection] = useState<SectionId>("agency");
  const [form, setForm]     = useState<AgencySettings>(initialSettings);
  const [dirty, setDirty]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<"ok" | "err" | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  function updateField<K extends keyof AgencySettings>(key: K, value: AgencySettings[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirty(true);
    setSaveResult(null);
  }

  function resetForm() {
    setForm(initialSettings);
    setDirty(false);
    setSaveResult(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("שגיאה בשמירה");
      setSaveResult("ok");
      setDirty(false);
      startTransition(() => router.refresh());
    } catch {
      setSaveResult("err");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("הקובץ גדול מדי. מקסימום 2MB."); return; }
    setLogoUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      updateField("logoUrl", reader.result as string);
      setLogoUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const sectionProps: SectionProps = {
    form, initialSettings, dirty, saving, saveResult,
    updateField, handleSave, resetForm,
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">הגדרות</h1>
          <p className="page-sub">ניהול פרטי הסוכנות, מיתוג, צוות והעדפות ברירת מחדל</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 20, alignItems: "start" }}>

        {/* Sidebar nav */}
        <div className="card" style={{ overflow: "hidden", position: "sticky", top: 16 }}>
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const isActive = activeSection === s.id;
            return (
              <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 9,
                padding: "11px 16px", border: "none", borderRadius: 0, cursor: "pointer",
                textAlign: "right",
                background: isActive ? "var(--accent-soft, #EEF0F9)" : "transparent",
                color: isActive ? "var(--accent, #1E2D7D)" : "var(--text-muted)",
                fontWeight: isActive ? 600 : 400, fontSize: 13,
                borderInlineStart: isActive ? "3px solid var(--accent, #1E2D7D)" : "3px solid transparent",
                transition: "all 0.15s",
              }}>
                <Icon size={14} />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Section content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {activeSection === "agency" && (
            <AgencySection
              {...sectionProps}
              logoUploading={logoUploading}
              logoInputRef={logoInputRef}
              handleLogoUpload={handleLogoUpload}
              handleRemoveLogo={() => updateField("logoUrl", "")}
            />
          )}
          {activeSection === "branding"  && <BrandingSection  {...sectionProps} />}
          {activeSection === "email"     && <EmailSection     {...sectionProps} />}
          {activeSection === "schedule"  && <ScheduleSection  {...sectionProps} />}
          {activeSection === "team"      && <TeamSection />}
        </div>
      </div>
    </div>
  );
}
