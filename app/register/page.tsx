import { HashMark } from "@/components/brand/hash-mark";
import { RegisterForm } from "./register-form";

export const metadata = { title: "צור סוכנות חדשה · Rankey" };

export default function RegisterPage() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--bg)", padding: 16,
    }}>
      <div style={{
        width: "100%", maxWidth: 420,
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)", overflow: "hidden",
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
            פלטפורמת דוחות SEO · צור סוכנות חדשה
          </div>
        </div>

        <RegisterForm />
      </div>
    </div>
  );
}
