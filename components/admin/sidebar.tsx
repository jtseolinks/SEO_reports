"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard, Users, FileText, Plug, Settings, ChevronDown,
} from "lucide-react";

const NAV_MANAGEMENT = [
  { href: "/admin",         label: "לוח בקרה",    icon: LayoutDashboard, exact: true, countKey: null },
  { href: "/admin/clients", label: "לקוחות",       icon: Users,           countKey: "clients" as const },
  { href: "/admin/reports", label: "דוחות",        icon: FileText,        countKey: "reports" as const },
];
const NAV_CONFIG = [
  { href: "/admin/google",   label: "אינטגרציות", icon: Plug },
  { href: "/admin/settings", label: "הגדרות",     icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

type Counts = { clients: number; reports: number };

export function Sidebar({ counts }: { counts?: Counts }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const displayName = session?.user?.name ?? session?.user?.email ?? "Admin";
  const email = session?.user?.email ?? "";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const badgeFor = (key: "clients" | "reports" | null): number | null => {
    if (!key || !counts) return null;
    return counts[key] ?? null;
  };

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="logo"><span className="hash">#</span></div>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-navy)", letterSpacing: "-0.01em" }}>
            Rankey
          </div>
          <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-faint)", fontWeight: 600 }}>
            SEO Reports
          </div>
        </div>
        <div style={{ marginInlineStart: "auto", fontSize: 10, fontWeight: 700, color: "var(--brand-navy)", background: "var(--accent-soft)", padding: "2px 8px", borderRadius: "var(--r-pill)" }}>
          Pro
        </div>
      </div>

      {/* Management nav */}
      <div className="nav-section-label">ניהול</div>
      {NAV_MANAGEMENT.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        const Icon = item.icon;
        const badge = badgeFor(item.countKey);
        return (
          <Link key={item.href} href={item.href} className={`nav-item${active ? " active" : ""}`}>
            <Icon size={16} className="nav-icon" />
            <span>{item.label}</span>
            {badge != null && badge > 0 && (
              <span className="nav-badge">{badge}</span>
            )}
          </Link>
        );
      })}

      {/* Config nav */}
      <div className="nav-section-label">תצורה</div>
      {NAV_CONFIG.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className={`nav-item${active ? " active" : ""}`}>
            <Icon size={16} className="nav-icon" />
            <span>{item.label}</span>
          </Link>
        );
      })}

      {/* Footer */}
      <div className="sidebar-foot">
        <button
          className="user-card"
          style={{ width: "100%", textAlign: "start", background: "none", border: "none" }}
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="יציאה מהמערכת"
        >
          <div className="user-ava">{initials}</div>
          <div className="meta">
            <div className="n">{displayName}</div>
            <div className="e">{email}</div>
          </div>
          <ChevronDown size={14} color="var(--text-faint)" />
        </button>
      </div>
    </aside>
  );
}
