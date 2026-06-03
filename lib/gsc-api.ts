import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export type GscSite = {
  siteUrl: string;
  permissionLevel: string;
};

export async function listGscSites(auth: OAuth2Client): Promise<GscSite[]> {
  const sc = google.webmasters({ version: "v3", auth });
  const { data } = await sc.sites.list();
  return (data.siteEntry ?? []).map((site) => ({
    siteUrl: site.siteUrl ?? "",
    permissionLevel: site.permissionLevel ?? "",
  }));
}

export type GscRow = {
  query?: string;
  page?: string;
  country?: string;
  device?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscDateRow = {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export async function fetchGscSummary(
  auth: OAuth2Client,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[] = ["query"]
): Promise<GscRow[]> {
  const sc = google.webmasters({ version: "v3", auth });

  const { data } = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions,
      rowLimit: 500,
    },
  });

  return (data.rows ?? []).map((row) => {
    const keys = row.keys ?? [];
    const entry: GscRow = {
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    };
    dimensions.forEach((dim, i) => {
      if (dim === "query") entry.query = keys[i];
      if (dim === "page") entry.page = keys[i];
      if (dim === "country") entry.country = keys[i];
      if (dim === "device") entry.device = keys[i];
    });
    return entry;
  });
}

export async function fetchGscDailyTrend(
  auth: OAuth2Client,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<GscDateRow[]> {
  const sc = google.webmasters({ version: "v3", auth });

  const { data } = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["date"],
      rowLimit: 93,
    },
  });

  return (data.rows ?? []).map((row) => ({
    date: row.keys?.[0] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

export function aggregateGsc(rows: GscRow[]) {
  return rows.reduce(
    (acc, r) => ({
      clicks: acc.clicks + r.clicks,
      impressions: acc.impressions + r.impressions,
      // Weighted CTR and position
      totalCtrWeight: acc.totalCtrWeight + r.ctr * r.impressions,
      totalPosWeight: acc.totalPosWeight + r.position * r.impressions,
    }),
    { clicks: 0, impressions: 0, totalCtrWeight: 0, totalPosWeight: 0 }
  );
}
