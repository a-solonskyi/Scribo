import test from "node:test";
import assert from "node:assert/strict";
import { encodeDraftRecovery, decodeDraftRecovery } from "./draftRecovery.js";
import { createDraftSaver } from "./studentDrafts.js";
import { validateDraftPayload } from "./draftValidation.js";
import { matchesLegacySubmission } from "./submissionCompatibility.js";
import { sanitizeStatistics, sanitizePasteEvents, sanitizePauseEvents } from "./submissionMetadata.js";
import { deriveSubmissionStatistics } from "./submissionStatistics.js";
import { getPasteRangesForText } from "./pasteHighlighting.js";
import { validateWritingHistory } from "./writingHistory.js";
import { createWritingEvent } from "./writingAnalytics.js";

const draft = (essayText = "Есе 📚\n\nSecond paragraph") => ({ studentName: "Student", essayText, essayHtml: `<p>${essayText}</p>`, eventLog: [], pasteEvents: [], pasteOriginRanges: [], pauseEvents: [], startedAt: 1 });

test("full backup snapshots Unicode, formatting, complete history and revision state without changing storage", async () => {
  const original = draft();
  original.eventLog = Array.from({ length: 6000 }, (_, sequence) => ({ sequence, inserted_text: "я", position: sequence }));
  const expected = structuredClone(original);
  const state = { revision: "acknowledged", pendingRevision: "pending", dirty: true };
  const exporting = encodeDraftRecovery({ assignment: { id: "assignment", public_token: "token", topic: "Topic" }, draft: original, userId: "owner", saveState: state });
  original.essayText += " edit while exporting";
  const file = await exporting;
  const restored = await decodeDraftRecovery(file);
  assert.deepEqual(restored.draft, expected);
  assert.deepEqual(restored.saveState, state);
  assert.equal(restored.userId, "owner");
  const damaged = JSON.parse(file);
  damaged.payload += " ";
  await assert.rejects(decodeDraftRecovery(JSON.stringify(damaged)), /damaged/);
});

for (const status of [400, 413]) test(`explicit retry resends after ${status}, while automatic flush remains blocked`, async () => {
  let calls = 0;
  let backup;
  const saver = createDraftSaver({ save: async (payload) => {
    if (++calls === 1) throw Object.assign(new Error("Rejected"), { status });
    return { revision: payload.revision };
  }, persist: (value) => { backup = value; return true; }, notify() {} });
  try {
    saver.update(draft());
    await assert.rejects(saver.flush(), { status });
    await assert.rejects(saver.flush(), { status });
    assert.equal(calls, 1);
    assert.equal(backup.dirty, true);
    await saver.flush({ retryValidation: true });
    assert.equal(calls, 2);
    assert.equal(backup.dirty, false);
  } finally { saver.stop(); }
});

for (const status of [401, 409, 404]) test(`manual retry cannot bypass protection after ${status}`, async () => {
  let calls = 0;
  const saver = createDraftSaver({ save: async () => { calls++; throw Object.assign(new Error("Blocked"), { status }); }, persist: () => true, notify() {} });
  try {
    saver.update(draft());
    await assert.rejects(saver.flush(), { status });
    saver.update(draft("Newer unsaved text"));
    await assert.rejects(saver.flush({ retryValidation: true }), { status });
    assert.equal(calls, 1);
    assert.equal(saver.isDirty(), true);
  } finally { saver.stop(); }
});

test("a rejected in-flight save retries the latest queued edits without losing their revision", async () => {
  let reject;
  const calls = [];
  const saver = createDraftSaver({ save: async (payload) => {
    calls.push(payload);
    if (calls.length === 1) await new Promise((_resolve, fail) => { reject = fail; });
    return { revision: payload.revision };
  }, persist: () => true, notify() {} });
  try {
    saver.update(draft("first"));
    const saving = saver.flush();
    saver.update(draft("latest"));
    const pendingRevision = saver.recoveryState().pendingRevision;
    reject(Object.assign(new Error("Invalid old snapshot"), { status: 400 }));
    await assert.rejects(saving, { status: 400 });
    await saver.flush({ retryValidation: true });
    assert.equal(calls[1].draft.essayText, "latest");
    assert.equal(calls[1].revision, pendingRevision);
  } finally { saver.stop(); }
});

test("specific draft errors preserve the previous acceptance limits and reveal no content", () => {
  const base = { draft: draft(), revision: crypto.randomUUID(), baseRevision: null };
  assert.equal(validateDraftPayload(base), null);
  for (const [field, value] of [["essayHtml", "x".repeat(500001)], ["startedAt", "private timestamp"], ["pasteOriginRanges", {}]]) {
    const issue = validateDraftPayload({ ...base, draft: { ...base.draft, [field]: value } });
    assert.equal(issue.field, field);
    assert.match(issue.error, /full backup/);
    assert.ok(!issue.error.includes("private timestamp"));
  }
});

test("malformed metadata has a safe projection while original evidence is untouched", () => {
  const raw = { wordCount: { invalid: true }, finalHtml: [], deviceInfo: { ip: {} }, pasteDetectionVersion: 2, pasteOriginRanges: [null, {}, { start: 0, end: 4 }] };
  const before = JSON.stringify(raw);
  const safe = sanitizeStatistics(raw);
  assert.equal(safe.wordCount, 0);
  assert.equal(safe.finalHtml, "");
  assert.equal(safe.deviceInfo.ip, null);
  assert.deepEqual(getPasteRangesForText("Essay", [], [], raw.pasteOriginRanges), [{ start: 0, end: 4, pasteEvent: null }]);
  assert.deepEqual(sanitizePauseEvents([null, { start_ms: 0, end_ms: -1 }]), []);
  assert.equal(sanitizePasteEvents([null, { pasted_text: {} }])[0].pasted_text, "");
  assert.equal(JSON.stringify(raw), before);
});

test("new statistics are derived from text and events, not claimed counts, pauses or origins", () => {
  const text = "A short essay";
  const events = [createWritingEvent({ previousText: "", nextText: text, timestampMs: 1000 })];
  const original = JSON.stringify(events);
  const stats = deriveSubmissionStatistics({ finalText: text, eventLog: events, integrity: validateWritingHistory(events, text), reportedStats: { wordCount: 987654, activeWritingTimeMs: 999999, pasteOriginRanges: [null], replayRecovery: { recoveredAt: "fabricated" } } });
  assert.equal(stats.wordCount, 3);
  assert.equal(stats.activeWritingTimeMs, 1000);
  assert.equal(stats.analyticsSource, "validated_history");
  assert.equal(stats.replayRecovery, undefined);
  assert.deepEqual(stats.pasteOriginRanges, []);
  assert.equal(JSON.stringify(events), original);
  const incomplete = deriveSubmissionStatistics({ finalText: text, eventLog: [null], integrity: { status: "incomplete" }, reportedStats: {} });
  assert.equal(incomplete.wordCount, 3);
  assert.equal(incomplete.analyticsSource, "text_only_incomplete_history");
});

test("legacy compatibility only recognizes the exact old transformation of a complete matching draft", () => {
  const events = Array.from({ length: 6000 }, (_, index) => ({ event_type: "insert", position: index, inserted_text: "a", timestamp_ms: index }));
  const snapshot = { ...draft("a".repeat(6000)), eventLog: events };
  const body = { student_name: "Student", final_text: snapshot.essayText, event_log_json: events.slice(-4000) };
  assert.equal(matchesLegacySubmission(snapshot, body), true);
  assert.equal(matchesLegacySubmission(snapshot, { ...body, client_version: 2 }), false);
  assert.equal(matchesLegacySubmission(snapshot, { ...body, student_name: "Different student" }), false);
  assert.equal(matchesLegacySubmission(snapshot, { ...body, final_text: "Different essay" }), false);
  assert.equal(matchesLegacySubmission(snapshot, { ...body, event_log_json: events.slice(-3999) }), false);
  assert.equal(matchesLegacySubmission({ ...snapshot, eventLog: events.slice(1) }, body), false);
});

test("legacy compatibility recognizes mixed edits and the historical zero-slot edge case exactly", () => {
  const inserts = Array.from({ length: 6000 }, (_, index) => ({ event_type: "insert", position: index, inserted_text: "a", timestamp_ms: index }));
  const deletion = { event_type: "delete", position: 5999, deleted_character_count: 1, timestamp_ms: 6000 };
  const mixed = { ...draft("a".repeat(5999)), eventLog: [...inserts, deletion] };
  assert.equal(matchesLegacySubmission(mixed, { student_name: "Student", final_text: mixed.essayText, event_log_json: [...inserts.slice(-3999), deletion] }), true);
  const initial = { event_type: "insert", position: 0, inserted_text: "a", timestamp_ms: 0 };
  const replacements = Array.from({ length: 4000 }, (_, index) => ({ event_type: "replace", position: 0, deleted_character_count: 1, inserted_text: "a", timestamp_ms: index + 1 }));
  const snapshot = { ...draft("a"), eventLog: [initial, ...replacements] };
  assert.equal(matchesLegacySubmission(snapshot, { student_name: "Student", final_text: "a", event_log_json: snapshot.eventLog }), true);
  assert.equal(matchesLegacySubmission(snapshot, { student_name: "Student", final_text: "a", event_log_json: replacements }), false);
});

test("derived paste metrics use actual splices and retain two distinct equal paste operations", () => {
  const events = [0, 1].map((index) => ({ event_type: "paste", position: index * 5, inserted_text: "Essay", pasted_text: "Fabricated clipboard contents", timestamp_ms: index + 1, deleted_character_count: 0 }));
  const stats = deriveSubmissionStatistics({ finalText: "EssayEssay", eventLog: events, integrity: validateWritingHistory(events, "EssayEssay"), reportedStats: {} });
  assert.equal(stats.pasteEventCount, 2);
  assert.equal(stats.totalPastedCharacters, 10);
  assert.equal(stats.largestPasteEvent, 5);
  assert.equal(stats.finalPastedCharacters, 10);
});
