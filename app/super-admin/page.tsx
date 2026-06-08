export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { SuperAdminClient } from "./super-admin-client";

async function getStats() {
  const [agencyCount, userCount, clientCount, reportCount] = await Promise.all([
    prisma.agency.count(),
    prisma.user.count(),
    prisma.client.count({ where: { status: "ACTIVE" } }),
    prisma.monthlyReport.count(),
  ]);
  return { agencyCount, userCount, clientCount, reportCount };
}

export default async function SuperAdminPage() {
  const stats = await getStats();
  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>ניהול פלטפורמה</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          כלל הסוכנויות והמשתמשים במערכת
        </p>
      </div>
      <SuperAdminClient initialStats={stats} />
    </>
  );
}
