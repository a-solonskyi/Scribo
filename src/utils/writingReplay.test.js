import test from "node:test";
import assert from "node:assert/strict";
import { createWritingEvent } from "./writingAnalytics.js";
import { applyWritingEvent, replayUntil } from "./replayEngine.js";
import { createWritingClock, getWritingTimeline, initializeWritingEvents, validateWritingHistory } from "./writingHistory.js";
import { assertSubmissionFits, decodeSubmissionHistory, prepareSubmissionHistory, readSubmissionJson } from "./submissionHistory.js";
import { encodeDraft, decodeDraft } from "./draftEncoding.js";
import { trimEventLog } from "./eventCompression.js";
import { reconstructOriginMap, getEffectivePasteEvents } from "./characterOrigins.js";

function recorder(initial = []) {
  const events = initializeWritingEvents(initial);
  let text = replayUntil(events, Infinity).text;
  return {
    events,
    get text() { return text; },
    change(next, timestampMs = events.length * 300, options = {}) {
      const event = createWritingEvent({ previousText: text, nextText: next, timestampMs, ...options });
      assert.ok(event);
      events.push({ ...event, sequence: events.length });
      text = next;
    },
  };
}

for (const count of [3999, 4000, 4001, 6000]) {
  test(`submission storage retains all ${count} ordered events`, async () => {
    const log = recorder();
    for (let i = 0; i < count; i++) log.change(log.text + String.fromCharCode(97 + i % 26));
    const stored = await prepareSubmissionHistory(trimEventLog(log.events), log.text);
    assert.equal(stored.integrity.status, "complete");
    const loaded = await decodeSubmissionHistory(stored.encoded);
    assert.deepEqual(loaded, log.events);
    assert.equal(replayUntil(loaded, Infinity).text, log.text);
    assertSubmissionFits([stored.encoded, log.text]);
  });
}

test("replacement paste and later edits share text/origin splice semantics", () => {
  const log = recorder();
  log.change("Hello world");
  log.change("Hello earth", 300, { forcePaste: true });
  log.change("Hello earth!", 600);
  log.change("Hello arth!", 900);
  assert.equal(replayUntil(log.events, 300).text, "Hello earth");
  assert.equal(replayUntil(log.events, Infinity).text, log.text);
  assert.deepEqual(reconstructOriginMap(log.events), [false, false, false, false, false, false, true, true, true, true, false]);
  assert.deepEqual(reconstructOriginMap(log.events, getEffectivePasteEvents(log.events)), reconstructOriginMap(log.events));
});

test("bulk replacement, Unicode, paragraphs, undo and redo round-trip each frame", async () => {
  const log = recorder();
  const states = ["Початок 📚", "Початок 📚\n\nDeuxième", "N".repeat(100), "Початок 📚\n\nDeuxième", "N".repeat(100), "", "The end."];
  states.forEach((state, i) => log.change(state, i * 100));
  const { encoded } = await prepareSubmissionHistory(log.events, log.text);
  const loaded = await decodeSubmissionHistory(encoded);
  states.forEach((state, i) => assert.equal(replayUntil(loaded, i * 100).text, state));
  for (const i of [6, 0, 4, 1, 5, 3, 6]) assert.equal(replayUntil(loaded, i * 100).text, states[i]);
});

test("sequence order survives timestamp ties, clock rollback and unordered transport", () => {
  const log = recorder();
  log.change("a", 100);
  log.change("ba", 100);
  log.change("cba", 50);
  const shuffled = [log.events[2], log.events[0], log.events[1]];
  assert.equal(replayUntil(shuffled, Infinity).text, "cba");
  assert.deepEqual(getWritingTimeline(shuffled).map((event) => event.timestamp_ms), [100, 100, 100]);
  const legacy = log.events.map(({ sequence, ...event }) => event);
  assert.equal(replayUntil(legacy, Infinity).text, "cba");
});

test("legacy JSON submission rows remain readable", async () => {
  const log = recorder(); log.change("Legacy essay");
  const legacy = log.events.map(({ sequence, ...event }) => event);
  const loaded = await decodeSubmissionHistory(JSON.stringify(legacy));
  assert.equal(validateWritingHistory(loaded, log.text).status, "complete");
  assert.equal(replayUntil(loaded, Infinity).text, log.text);
});

test("draft save/reload continues sequence and elapsed time after device clock changes", async () => {
  let wall = 10_000;
  let mono = 50;
  const firstClock = createWritingClock({ startedAt: 10_000, wallNow: () => wall, monotonicNow: () => mono });
  const log = recorder();
  mono += 300; log.change("a", firstClock());
  wall -= 5000; mono += 300; log.change("ab", firstClock());
  const draft = await decodeDraft(await encodeDraft({ eventLog: log.events, startedAt: 10_000 }));
  const resumed = recorder(draft.eventLog);
  const secondClock = createWritingClock({ ...draft, wallNow: () => wall, monotonicNow: () => mono });
  mono += 200; resumed.change("abc", secondClock());
  assert.deepEqual(resumed.events.map((event) => event.sequence), [0, 1, 2]);
  assert.deepEqual(resumed.events.map((event) => event.timestamp_ms), [300, 600, 800]);
  assert.equal(validateWritingHistory(resumed.events, "abc").status, "complete");
});

test("missing operations, malformed positions, lengths, sequences and final text fail validation", () => {
  const log = recorder(); log.change("abc"); log.change("abc!");
  assert.equal(validateWritingHistory(log.events.slice(1), log.text).status, "incomplete");
  for (const patch of [{ position: -1 }, { position: 100 }, { deleted_character_count: 10 }, { inserted_text: 1 }, { current_text_length: 100 }, { sequence: 5 }, { timestamp_ms: NaN }]) {
    assert.equal(validateWritingHistory([{ ...log.events[0], ...patch }], "abc").status, "incomplete");
  }
  assert.equal(validateWritingHistory(log.events, "xyz!").reason, "final_text_mismatch");
  assert.equal(validateWritingHistory(null, "essay").status, "incomplete");
  assert.equal(validateWritingHistory([null], "essay").status, "incomplete");
  assert.deepEqual(getEffectivePasteEvents([null]), []);
  assert.throws(() => applyWritingEvent("", log.events[1]), /invalid_position/);
});

test("inconsistent history is retained with an incomplete status, not fabricated", async () => {
  const log = recorder(); log.change("abc"); log.change("abc!");
  const damaged = log.events.slice(1);
  const result = await prepareSubmissionHistory(damaged, log.text);
  assert.equal(result.integrity.status, "incomplete");
  assert.deepEqual(await decodeSubmissionHistory(result.encoded), damaged);
  assert.throws(() => assertSubmissionFits([result.encoded, log.text], 10), { status: 413 });
});

test("request size limits reject oversized UTF-8 and invalid JSON explicitly", async () => {
  const body = JSON.stringify({ final_text: "📚", event_log_json: [] });
  const request = () => new Request("https://example.test/", { method: "POST", body });
  assert.equal((await readSubmissionJson(request())).final_text, "📚");
  await assert.rejects(readSubmissionJson(request(), body.length), { status: 413 });
  await assert.rejects(readSubmissionJson(new Request("https://example.test/", { method: "POST", body: "[1]" })), { status: 400 });
});
