import { strict as assert } from "node:assert";
import { test } from "node:test";
import { formatTimestamp, formatTimezone, localTimezone } from "../src/time.js";

test("formatTimestamp normalizes to UTC with milliseconds", () => {
  assert.equal(formatTimestamp("2020-09-21T15:30:05.123+01:00"), "2020-09-21T14:30:05.123Z");
  assert.equal(
    formatTimestamp(new Date(Date.UTC(2020, 8, 21, 14, 30, 5))),
    "2020-09-21T14:30:05.000Z",
  );
  assert.equal(formatTimestamp("2020-09-21T14:30:05Z"), "2020-09-21T14:30:05.000Z");
  assert.equal(formatTimestamp(0), "1970-01-01T00:00:00.000Z");
  assert.throws(() => formatTimestamp("nope"), RangeError);
});

test("formatTimezone renders UTC offsets", () => {
  assert.equal(formatTimezone(0), "UTC+00:00");
  assert.equal(formatTimezone(60), "UTC+01:00");
  assert.equal(formatTimezone(-75), "UTC-01:15");
  assert.equal(formatTimezone(330), "UTC+05:30");
});

test("localTimezone mirrors the date offset", () => {
  const d = new Date(Date.UTC(2020, 5, 1));
  assert.equal(localTimezone(d), formatTimezone(-d.getTimezoneOffset()));
});
