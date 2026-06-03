export const dynamic = "force-dynamic";

import { getGoogleConnection } from "@/lib/google-oauth";
import { prisma } from "@/lib/prisma";
import { GoogleConnectionClient } from "./google-connection-client";

export default async function GooglePage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [params, connection] = await Promise.all([
    searchParams,
    getGoogleConnection(),
  ]);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [monitoredCount, ga4Count, gscCount, emailsSentThisMonth] = await Promise.all([
    prisma.client.count({ where: { googleProperties: { isNot: null } } }),
    prisma.clientGoogleProperty.count({ where: { ga4PropertyId: { not: "" } } }),
    prisma.clientGoogleProperty.count(),
    prisma.reportEmailLog.count({ where: { createdAt: { gte: startOfMonth } } }),
  ]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">אינטגרציות</h1>
          <p className="page-sub">
            חיבור חד-פעמי לחשבון Google שלך — ממנו המערכת שואבת את הנתונים של כל הלקוחות
          </p>
        </div>
      </div>

      <GoogleConnectionClient
        connection={
          connection
            ? {
                id: connection.id,
                googleEmail: connection.googleEmail,
                status: connection.status,
                lastError: connection.lastError,
                updatedAt: connection.updatedAt.toISOString(),
                createdAt: connection.createdAt.toISOString(),
              }
            : null
        }
        stats={{ monitored: monitoredCount, ga4Count, gscCount, emailsSentThisMonth }}
        sendgridConnected={!!(process.env.SENDGRID_API_KEY)}
        successMessage={params.success === "1" ? "חשבון Google חובר בהצלחה." : undefined}
        errorMessage={params.error ? formatOAuthError(params.error) : undefined}
      />
    </div>
  );
}

function formatOAuthError(error: string): string {
  const known: Record<string, string> = {
    access_denied: "הגישה נדחתה. יש לאשר את ההרשאות הנדרשות.",
    missing_code: "קוד ה-OAuth חסר מה-callback.",
    token_exchange_failed: "הייבוא של קוד ההרשאה נכשל.",
    "No refresh token received. Revoke app access in Google account and try again.":
      "לא התקבל Refresh Token. בטל את הרשאות האפליקציה בחשבון Google ונסה שוב.",
  };
  return known[error] ?? error;
}
