export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Building2, Users, FileText, Wifi, WifiOff, Globe } from "lucide-react";

async function getStats() {
  const [agencyCount, userCount, clientCount, reportCount] = await Promise.all([
    prisma.agency.count(),
    prisma.user.count(),
    prisma.client.count({ where: { status: "ACTIVE" } }),
    prisma.monthlyReport.count(),
  ]);
  return { agencyCount, userCount, clientCount, reportCount };
}

async function getAgencies() {
  const agencies = await prisma.agency.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { memberships: true, clients: true, monthlyReports: true } },
      googleConnection: { select: { status: true, googleEmail: true } },
      memberships: {
        where: { role: "OWNER" },
        include: { user: { select: { email: true, name: true } } },
        take: 1,
      },
    },
  });
  return agencies;
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number; color: string;
}) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--r-lg)", padding: "20px 24px",
      display: "flex", alignItems: "center", gap: 16,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: `${color}18`, display: "grid", placeItems: "center",
      }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{value.toLocaleString()}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
}

function GoogleBadge({ status, email }: { status: string | null; email: string | null }) {
  if (!status) return <span style={{ fontSize: 12, color: "var(--text-faint)" }}>—</span>;
  const connected = status === "CONNECTED";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11,
      color: connected ? "var(--green, #16a34a)" : "var(--red, #dc2626)",
    }}>
      {connected ? <Wifi size={11} /> : <WifiOff size={11} />}
      {email ?? (connected ? "מחובר" : status)}
    </span>
  );
}

export default async function SuperAdminPage() {
  const [stats, agencies] = await Promise.all([getStats(), getAgencies()]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Page title */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>סקירה כללית</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
          כל הסוכנויות הפעילות בפלטפורמה
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <StatCard icon={Building2} label="סוכנויות"      value={stats.agencyCount} color="#1E2D7D" />
        <StatCard icon={Users}     label="משתמשים"      value={stats.userCount}   color="#5BC2F0" />
        <StatCard icon={Globe}     label="לקוחות פעילים" value={stats.clientCount} color="#16a34a" />
        <StatCard icon={FileText}  label="דוחות"         value={stats.reportCount} color="#f59e0b" />
      </div>

      {/* Agencies table */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)", overflow: "hidden",
      }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
            סוכנויות ({agencies.length})
          </h2>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface-sunken)" }}>
                {["סוכנות", "בעלים", "חברים", "לקוחות", "דוחות", "Google", "תאריך"].map(h => (
                  <th key={h} style={{
                    padding: "10px 16px", textAlign: "start",
                    fontWeight: 600, color: "var(--text-muted)",
                    borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agencies.map((agency, i) => {
                const owner = agency.memberships[0]?.user;
                return (
                  <tr
                    key={agency.id}
                    style={{
                      borderBottom: i < agencies.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600 }}>{agency.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "monospace" }}>
                        {agency.slug}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {owner ? (
                        <div>
                          <div>{owner.name ?? "—"}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{owner.email}</div>
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-faint)" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      {agency._count.memberships}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      {agency._count.clients}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      {agency._count.monthlyReports}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <GoogleBadge
                        status={agency.googleConnection?.status ?? null}
                        email={agency.googleConnection?.googleEmail ?? null}
                      />
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {new Date(agency.createdAt).toLocaleDateString("he-IL")}
                    </td>
                  </tr>
                );
              })}
              {agencies.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-faint)" }}>
                    אין סוכנויות רשומות
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
