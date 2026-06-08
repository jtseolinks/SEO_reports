import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { HashMark } from "@/components/brand/hash-mark";
import { LayoutDashboard, ArrowRight } from "lucide-react";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isSuperAdmin) redirect("/admin");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* Top nav */}
      <nav style={{
        background: "var(--brand-navy)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "0 24px",
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            display: "inline-grid", placeItems: "center",
            width: 30, height: 30, borderRadius: 8,
            background: "rgba(91,194,240,0.15)",
          }}>
            <HashMark size={16} color="var(--brand-cyan)" />
          </div>
          <span style={{ color: "white", fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>
            Rankey
          </span>
          <span style={{
            background: "rgba(91,194,240,0.2)", color: "#5BC2F0",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
            padding: "2px 7px", borderRadius: 4, textTransform: "uppercase",
          }}>
            Super Admin
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link
            href="/admin"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              color: "#BFCDE8", fontSize: 13, textDecoration: "none",
            }}
          >
            <LayoutDashboard size={14} />
            חזרה לממשק
            <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div style={{ flex: 1, padding: "32px 24px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        {children}
      </div>
    </div>
  );
}
