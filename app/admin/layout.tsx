import { Sidebar } from "@/components/admin/sidebar";
import { Topbar } from "@/components/admin/header";
import { SessionProvider } from "@/components/admin/session-provider";
import { prisma } from "@/lib/prisma";

async function getNavCounts() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [clients, reports] = await Promise.all([
    prisma.client.count({ where: { status: "ACTIVE" } }),
    prisma.monthlyReport.count({ where: { reportMonth: currentMonth } }),
  ]);
  return { clients, reports };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const counts = await getNavCounts();
  return (
    <SessionProvider>
      <div className="app-shell">
        <Sidebar counts={counts} />
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
