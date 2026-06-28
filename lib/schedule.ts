// Single source of truth for resolving a client's *effective* auto-send schedule.
//
// Model: the agency's global `defaultSendDay` is the live default. A client only
// deviates when it carries an explicit override (`sendDayCustom = true`), in
// which case its own `reportSendDay` / `reportSendHour` win. Non-custom clients
// follow the global default dynamically - nothing is copied, so changing the
// global setting takes effect everywhere at once with no drift.

// Default send hour for non-custom clients. The settings UI presents the global
// schedule as "<day> of month, 09:00"; there is no global hour override, so
// non-custom clients always send at 09:00 (Asia/Jerusalem).
export const DEFAULT_SEND_HOUR = 9;

type ClientSchedule = {
  reportSendDay: number;
  reportSendHour: number;
  sendDayCustom: boolean;
};

// Effective day-of-month a client's report sends on.
export function effectiveSendDay(
  client: Pick<ClientSchedule, "reportSendDay" | "sendDayCustom">,
  defaultSendDay: number,
): number {
  return client.sendDayCustom ? client.reportSendDay : defaultSendDay;
}

// Effective send hour (0–23, Asia/Jerusalem).
export function effectiveSendHour(
  client: Pick<ClientSchedule, "reportSendHour" | "sendDayCustom">,
  defaultSendHour: number = DEFAULT_SEND_HOUR,
): number {
  return client.sendDayCustom ? client.reportSendHour : defaultSendHour;
}

// Parses the agency settings' `defaultSendDay` string into a valid 1–28 day,
// falling back to 5 if missing/invalid (matches the column default).
export function parseDefaultSendDay(value: string | undefined | null): number {
  const n = parseInt(String(value ?? ""), 10);
  return !isNaN(n) && n >= 1 && n <= 28 ? n : 5;
}
