import { parseIsoTimestamp } from "./iso-time.js";

/**
 * Formats a date as `yyyy-MM-ddThh:mm:ss.sssZ` in UTC. A string must be ISO 8601 with an
 * explicit zone (`Z`, `+hh:mm` or `-hh:mm`; seconds and fraction optional) and a real calendar
 * date: `2020-09-21T14:30:05` (no zone), `Sep 21 2020` and `2021-02-30T13:23Z` are rejected.
 * Throws a RangeError when the value is not a valid date.
 */
export function formatTimestamp(value: Date | string | number): string {
  let date: Date;
  if (value instanceof Date) date = value;
  else if (typeof value === "string") date = new Date(parseIsoTimestamp(value) ?? Number.NaN);
  else date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`invalid date: ${String(value)}`);
  }
  return date.toISOString();
}

/** Formats an offset in minutes east of UTC as `UTC+hh:mm` or `UTC-hh:mm`. */
export function formatTimezone(offsetMinutesEastOfUtc: number): string {
  const sign = offsetMinutesEastOfUtc < 0 ? "-" : "+";
  const abs = Math.abs(Math.round(offsetMinutesEastOfUtc));
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

/** The timezone header value for the runtime's local zone at the given date (default now). */
export function localTimezone(date: Date = new Date()): string {
  return formatTimezone(-date.getTimezoneOffset());
}
