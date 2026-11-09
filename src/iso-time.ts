const ISO =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:(Z)|([+-])(\d{2}):(\d{2}))$/;

/**
 * Parses an ISO 8601 date-time with an explicit zone (`Z` or `+hh:mm` / `-hh:mm`, seconds and
 * fraction optional) into epoch milliseconds. Every calendar and clock component is checked, so
 * `2021-02-30T13:23Z` is rejected rather than rolled over. Returns undefined when invalid.
 * Internal: not re-exported from the package entry point.
 */
export function parseIsoTimestamp(value: string): number | undefined {
  const m = ISO.exec(value);
  if (!m) return undefined;
  const n = (i: number): number => Number(m[i] ?? "0");
  const [year, month, day, hour, minute, second] = [n(1), n(2), n(3), n(4), n(5), n(6)];
  const millis = Number((m[7] ?? "").padEnd(3, "0").slice(0, 3));
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) {
    return undefined;
  }
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  date.setUTCHours(hour, minute, second, millis);
  let offset = 0;
  if (m[8] === undefined) {
    const oh = n(10);
    const om = n(11);
    if (oh > 23 || om > 59) return undefined;
    offset = (m[9] === "-" ? -1 : 1) * (oh * 60 + om);
  }
  const time = date.getTime() - offset * 60_000;
  return Number.isNaN(time) ? undefined : time;
}
