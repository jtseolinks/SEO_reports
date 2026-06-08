import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/admin/sidebar";
import { Topbar } from "@/components/admin/header";
import { SessionProvider } from "@/components/admin/session-provider";
import { prisma } from "@/lib/prisma";

// Fetches in parallel — does NOT block layout render.
// Scoped to the active agency so counts are per-tenant.
async function SidebarWithCounts() {
  const session = await getServerSession(authOptions);
  const agencyId = session?.user?.agencyId;
  if (!agencyId) return <Sidebar counts={{ clients: 0, reports: 0 }} />;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [clients, reports] = await Promise.all([
    prisma.client.count({ where: { agencyId, status: "ACTIVE" } }),
    prisma.monthlyReport.count({ where: { agencyId, reportMonth: currentMonth } }),
  ]);
  return <Sidebar counts={{ clients, reports }} />;
}

// Sync (not async) — renders immediately, no blocking
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="app-shell">
        <Suspense fallback={<Sidebar counts={{ clients: 0, reports: 0 }} />}>
          <SidebarWithCounts />
        </Suspense>
        <div className="main">
          <Topbar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
