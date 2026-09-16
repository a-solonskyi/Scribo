import assert from "node:assert/strict";
import test from "node:test";
import { deadlineFill, deadlineProgress } from "./deadlineProgress.js";

test("deadline wine is empty at the start, full exactly at the deadline, and overflows only afterwards", () => {
  const start = "2026-09-16T12:00:00Z";
  const end = "2026-09-16T13:00:00Z";
  assert.equal(deadlineProgress(start, end, Date.parse(start) - 1), 0);
  assert.equal(deadlineProgress(start, end, Date.parse(start)), 0);
  assert.equal(deadlineProgress(start, end, Date.parse("2026-09-16T12:30:00Z")), 0.5);
  assert.equal(deadlineProgress(start, end, Date.parse(end)), 1);
  assert.ok(deadlineProgress(start, end, Date.parse(end) + 1) > 1);
  assert.equal(deadlineFill(1.25), 1);
  assert.equal(deadlineFill(-0.25), 0);
});

test("missing, invalid, and reversed deadline intervals cannot invent progress", () => {
  assert.equal(deadlineProgress(undefined, "2026-09-16T13:00:00Z"), null);
  assert.equal(deadlineProgress(null, "2026-09-16T13:00:00Z"), null);
  assert.equal(deadlineProgress(1000, 2000, NaN), null);
  assert.equal(deadlineProgress("invalid", "invalid"), null);
  assert.equal(deadlineProgress(1000, 1000, 1000), null);
  assert.equal(deadlineProgress(2000, 1000, 1500), null);
});
