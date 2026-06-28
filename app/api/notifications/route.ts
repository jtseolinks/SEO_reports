import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgency, toResponse } from "@/lib/authz";
import { getGoogleConnection, getAuthenticatedClient } from "@/lib/google-oauth";
import { listGscSites } from "@/lib/gsc-api";

export type Notification = {
  id: string;
  /** critical = always visible, only acknowledgeable (hides bell dot).
   *  warn     = dismissible forever via localStorage. */
  type: "critical" | "warn";
  title: string;
  body: string;
  href?: string;
};

export async function GET() {
  let ctx;
  try {
    ctx = await requireAgency();
  } catch (e) {
    return toResponse(e);
  }

  const notes: Notification[] = [];

  // ── 1. Google connection status ──────────────────────────────────────────────
  const connection = await getGoogleConnection(ctx.agencyId);

  if (!connection) {
    notes.push({
      id: "no-google",
      type: "critical" as const,
      title: "Google לא מחובר",
      body: "חבר חשבון Google כדי לשלוף נתוני GSC ו-GA4.",
      href: "/admin/google",
    });
    return NextResponse.json({ notifications: notes });
  }

  if (connection.status === "REQUIRES_REAUTH") {
    notes.push({
      id: "reauth",
      type: "critical" as const,
      title: "נדרש חיבור מחדש ל-Google",
      body: connection.lastError ?? "פג תוקף ה-Token. יש לנתק ולחבר מחדש.",
      href: "/admin/google",
    });
  } else if (connection.status === "ERROR") {
    notes.push({
      id: "google-err",
      type: "critical" as const,
      title: "שגיאה בחשבון Google",
      body: connection.lastError ?? "בדוק את עמוד האינטגרציות.",
      href: "/admin/google",
    });
  }

  // ── 2. Fetch all client properties + GSC site list in parallel ───────────────
  const [allProperties, auth] = await Promise.all([
    prisma.clientGoogleProperty.findMany({
      where: { client: { agencyId: ctx.agencyId } },
      include: { client: { select: { id: true, name: true, status: true } } },
    }),
    getAuthenticatedClient(ctx.agencyId),
  ]);

  // Build a set of sites the Google account actually has access to
  let accessibleSites = new Set<string>();
  if (auth) {
    try {
      const sites = await listGscSites(auth);
      accessibleSites = new Set(sites.map(s => s.siteUrl.toLowerCase()));
    } catch {
      /* If listing sites fails, skip this check */
    }
  }

  for (const prop of allProperties) {
    if (prop.client.status !== "ACTIVE") continue;

    // 2a. GSC permission check
    if (prop.gscSiteUrl && accessibleSites.size > 0) {
      const siteNormalized = prop.gscSiteUrl.toLowerCase();
      if (!accessibleSites.has(siteNormalized)) {
        notes.push({
          id: `gsc-perm-${prop.clientId}`,
          type: "critical" as const,
          title: `אין הרשאה ל-GSC - ${prop.client.name}`,
          body: `חשבון Google אינו מורשה לנכס "${prop.gscSiteUrl}". יש להוסיף הרשאה ב-Search Console.`,
          href: `/admin/clients/${prop.clientId}`,
        });
      }
    }

    // 2b. GA4 not configured
    if (!prop.ga4PropertyId || prop.ga4PropertyId.trim() === "") {
      notes.push({
        id: `no-ga4-${prop.clientId}`,
        type: "warn",
        title: `GA4 לא מוגדר - ${prop.client.name}`,
        body: "לקוח פעיל ללא חיבור Google Analytics 4.",
        href: `/admin/clients/${prop.clientId}`,
      });
    }
  }

  // ── 3. Clients with no Google properties at all ───────────────────────────────
  const noPropsClients = await prisma.client.findMany({
    where: {
      agencyId: ctx.agencyId,
      status: "ACTIVE",
      googleProperties: null,
      createdAt: { lte: new Date(Date.now() - 3 * 86_400_000) },
    },
    select: { id: true, name: true },
    take: 5,
  });

  for (const c of noPropsClients) {
    notes.push({
      id: `no-props-${c.id}`,
      type: "warn",
      title: `${c.name} - אין נכסי Google`,
      body: "לקוח פעיל ללא חיבור GSC/GA4.",
      href: `/admin/clients/${c.id}`,
    });
  }

  // ── 4. Recently failed reports ────────────────────────────────────────────────
  const failedReports = await prisma.monthlyReport.findMany({
    where: {
      agencyId: ctx.agencyId,
      status: "FAILED",
      updatedAt: { gte: new Date(Date.now() - 14 * 86_400_000) },
    },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  for (const r of failedReports) {
    notes.push({
      id: `report-fail-${r.id}`,
      type: "critical" as const,
      title: `יצירת דוח נכשלה - ${r.client.name}`,
      body: r.errorMessage?.slice(0, 120) ?? "שגיאה לא ידועה",
      href: `/admin/clients/${r.client.id}`,
    });
  }

  return NextResponse.json({ notifications: notes });
}
