import assert from "node:assert/strict";
import test from "node:test";
import { formatTimeLeft, localDeadlineToIso, normalizeDeadline } from "./deadlines.js";

test("a Kyiv deadline round-trips without the reported three-hour shift", () => {
  const originalTimezone = process.env.TZ;
  try {
    process.env.TZ = "Europe/Kyiv";
    const saved = normalizeDeadline(localDeadlineToIso("2026-09-17T23:10"));
    assert.equal(saved, "2026-09-17T20:10:00.000Z");
    const local = new Date(saved);
    assert.equal(local.getDate(), 17);
    assert.equal(local.getHours(), 23);
    assert.equal(local.getMinutes(), 10);
    assert.equal(localDeadlineToIso("2026-01-17T23:10"), "2026-01-17T21:10:00.000Z");
    process.env.TZ = "America/New_York";
    assert.equal(localDeadlineToIso("2026-09-17T23:10"), "2026-09-18T03:10:00.000Z");
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test("the server accepts explicit offsets and rejects ambiguous deadlines", () => {
  assert.equal(normalizeDeadline("2026-09-17T23:10:00+03:00"), "2026-09-17T20:10:00.000Z");
  assert.equal(normalizeDeadline(null), null);
  assert.equal(localDeadlineToIso(""), null);
  assert.throws(() => normalizeDeadline("2026-09-17T23:10"), /timezone/);
  assert.throws(() => normalizeDeadline("invalid"));
  assert.throws(() => localDeadlineToIso("invalid"));
});

test("time left handles days, minutes, and the deadline boundary", () => {
  const now = Date.parse("2026-09-16T20:10:00Z");
  assert.equal(formatTimeLeft("2026-09-17T23:15:00Z", now), "1d 3h 5m left");
  assert.equal(formatTimeLeft(now + 120000, now), "2m left");
  assert.equal(formatTimeLeft(now + 30000, now), "Less than a minute left");
  assert.equal(formatTimeLeft(now, now), "Deadline passed");
  assert.equal(formatTimeLeft(now - 1000, now), "Deadline passed");
});
