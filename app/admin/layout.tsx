import { Suspense } from "react";
import { Sidebar } from "@/components/admin/sidebar";
import { Topbar } from "@/components/admin/header";
import { SessionProvider } from "@/components/admin/session-provider";
import { prisma } from "@/lib/prisma";

// Fetches in parallel — does NOT block layout render
async function SidebarWithCounts() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [clients, reports] = await Promise.all([
    prisma.client.count({ where: { status: "ACTIVE" } }),
    prisma.monthlyReport.count({ where: { reportMonth: currentMonth } }),
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
