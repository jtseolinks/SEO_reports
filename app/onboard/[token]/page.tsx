import { getSetupToken } from "@/lib/setup-token";
import { OnboardClient } from "./onboard-client";

type Props = { params: Promise<{ token: string }> };

export default async function OnboardPage({ params }: Props) {
  const { token } = await params;
  const data = await getSetupToken(token);

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f6f9" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", textAlign: "center", maxWidth: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
          <h2 style={{ margin: "0 0 8px", color: "#1E2D7D" }}>קישור לא תקין</h2>
          <p style={{ color: "#6b7280", margin: 0 }}>הקישור שבו השתמשת אינו קיים במערכת.</p>
        </div>
      </div>
    );
  }

  if (data.expired || data.used) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f6f9" }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "48px 40px", textAlign: "center", maxWidth: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{data.used ? "✅" : "⏰"}</div>
          <h2 style={{ margin: "0 0 8px", color: "#1E2D7D" }}>
            {data.used ? "הגדרה הושלמה" : "הקישור פג תוקף"}
          </h2>
          <p style={{ color: "#6b7280", margin: "0 0 24px" }}>
            {data.used
              ? "חשבון הסוכנות הוגדר כבר. ניתן להתחבר."
              : "הקישור תקף ל-7 ימים בלבד. פנה לאדמין לשליחת קישור חדש."}
          </p>
          <a href="/login" style={{ display: "inline-block", background: "#1E2D7D", color: "#fff", borderRadius: 8, padding: "12px 32px", textDecoration: "none", fontWeight: 700 }}>
            עבור לכניסה ←
          </a>
        </div>
      </div>
    );
  }

  return (
    <OnboardClient
      token={token}
      agencyName={data.agencyName}
      email={data.email}
      userName={data.name}
      isOwner={data.isAgencySetup}
    />
  );
}
