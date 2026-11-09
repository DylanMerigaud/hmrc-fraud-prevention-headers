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

test("formatTimestamp: a string must be ISO 8601 with an explicit zone and a real calendar date", () => {
  for (const bad of [
    "2020-09-21T14:30:05",
    "Sep 21 2020",
    "2020-09-21",
    "2020-09-21 14:30:05Z",
    "2021-02-30T13:23Z",
    "2021-02-29T00:00:00Z",
    "2020-13-01T00:00Z",
    "2020-09-21T24:00Z",
    "2020-09-21T14:60Z",
    "2020-09-21T14:30:60Z",
    "2020-09-21T14:30+25:00",
    "",
  ]) {
    assert.throws(() => formatTimestamp(bad), RangeError, bad);
  }
  assert.equal(formatTimestamp("2020-02-29T23:59Z"), "2020-02-29T23:59:00.000Z");
  assert.equal(formatTimestamp("2020-09-21T14:30-01:15"), "2020-09-21T15:45:00.000Z");
  assert.equal(formatTimestamp("2020-09-21T14:30:05.1Z"), "2020-09-21T14:30:05.100Z");
  assert.equal(formatTimestamp("2020-09-21T14:30:05.123456Z"), "2020-09-21T14:30:05.123Z");
  assert.equal(formatTimestamp("0099-01-01T00:00Z"), "0099-01-01T00:00:00.000Z");
});
