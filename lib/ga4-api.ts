import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export type Ga4Property = {
  propertyId: string;
  displayName: string;
  accountId: string;
  accountName: string;
};

export async function listGa4Properties(auth: OAuth2Client): Promise<Ga4Property[]> {
  const admin = google.analyticsadmin({ version: "v1beta", auth });
  const properties: Ga4Property[] = [];

  // Use accountSummaries — returns accounts + all their properties in one call,
  // with full pagination support. Much faster and more complete than iterating
  // accounts then properties separately.
  let pageToken: string | undefined;

  do {
    const { data } = await admin.accountSummaries.list({
      pageSize: 200,
      ...(pageToken ? { pageToken } : {}),
    });

    for (const summary of data.accountSummaries ?? []) {
      const accountId   = summary.account?.replace("accounts/", "") ?? "";
      const accountName = summary.displayName ?? accountId;

      for (const propSummary of summary.propertySummaries ?? []) {
        const propertyId = propSummary.property?.replace("properties/", "") ?? "";
        if (!propertyId) continue;
        properties.push({
          propertyId,
          displayName: propSummary.displayName ?? propertyId,
          accountId,
          accountName,
        });
      }
    }

    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  return properties;
}

export type Ga4OrgRow = {
  landingPage?: string;
  sessions: number;
  keyEvents: number;
};

export type Ga4Summary = {
  sessions: number;
  revenue: number;
};

export async function fetchGa4OrganicSummary(
  auth: OAuth2Client,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<Ga4Summary> {
  const client = new BetaAnalyticsDataClient({ authClient: auth as never });

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [],
    metrics: [
      { name: "sessions" },
      { name: "purchaseRevenue" },
    ],
    dimensionFilter: {
      orGroup: {
        expressions: [
          { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { value: "Organic Search",  matchType: "EXACT" } } },
          { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { value: "Organic Shopping", matchType: "EXACT" } } },
        ],
      },
    },
  });

  const row = response.rows?.[0]?.metricValues ?? [];
  return {
    sessions: parseInt(row[0]?.value ?? "0"),
    revenue: parseFloat(row[1]?.value ?? "0"),
  };
}

export async function fetchGa4OrganicLandingPages(
  auth: OAuth2Client,
  propertyId: string,
  startDate: string,
  endDate: string,
  limit = 20
): Promise<Ga4OrgRow[]> {
  const client = new BetaAnalyticsDataClient({ authClient: auth as never });

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "landingPagePlusQueryString" }],
    metrics: [
      { name: "sessions" },
      { name: "keyEvents" },
    ],
    dimensionFilter: {
      orGroup: {
        expressions: [
          { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { value: "Organic Search",  matchType: "EXACT" } } },
          { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { value: "Organic Shopping", matchType: "EXACT" } } },
        ],
      },
    },
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit,
  });

  return (response.rows ?? []).map((row) => ({
    landingPage: row.dimensionValues?.[0]?.value ?? "",
    sessions: parseInt(row.metricValues?.[0]?.value ?? "0"),
    keyEvents: parseInt(row.metricValues?.[1]?.value ?? "0"),
  }));
}
