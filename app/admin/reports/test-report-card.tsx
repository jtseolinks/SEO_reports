"use client";

import { useState } from "react";
import { FileText, Mail, Loader2, ExternalLink } from "lucide-react";

export function TestReportCard() {
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(sendEmail: boolean) {
    sendEmail ? setLoadingEmail(true) : setLoadingPdf(true);
    setError(null);
    setPdfUrl(null);
    setSentTo(null);
    try {
      const res = await fetch("/api/reports/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendEmail }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPdfUrl(data.pdfUrl);
      if (data.sentTo) setSentTo(data.sentTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setLoadingPdf(false);
      setLoadingEmail(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-head">
        <div>
          <h3 className="card-title">דוח לדוגמה</h3>
          <p className="card-sub">צור PDF עם נתוני דמה לבדיקת עיצוב הדוח</p>
        </div>
      </div>
      <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            onClick={() => handleGenerate(false)}
            disabled={loadingPdf || loadingEmail}
            className="btn btn-secondary"
          >
            {loadingPdf
              ? <Loader2 size={14} className="animate-spin" />
              : <FileText size={14} />}
            צור PDF
          </button>
          <button
            onClick={() => handleGenerate(true)}
            disabled={loadingPdf || loadingEmail}
            className="btn btn-secondary"
          >
            {loadingEmail
              ? <Loader2 size={14} className="animate-spin" />
              : <Mail size={14} />}
            שלח לאימייל שלי
          </button>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: "var(--red)", background: "var(--red-soft)", border: "1px solid var(--red-soft-strong)", borderRadius: "var(--r-sm)", padding: "8px 12px" }}>
            {error}
          </div>
        )}

        {pdfUrl && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary accent sm"
            >
              <ExternalLink size={12} /> פתח PDF
            </a>
            {sentTo && (
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                נשלח ל: {sentTo}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
