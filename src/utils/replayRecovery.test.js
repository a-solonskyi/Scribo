import test from "node:test";
import assert from "node:assert/strict";
import { assessReplayRecovery, prepareReplayRecovery } from "./replayRecovery.js";
import { encodeDraft, decodeDraft } from "./draftEncoding.js";
import { decodeSubmissionHistory } from "./submissionHistory.js";
import { createWritingEvent } from "./writingAnalytics.js";
import { validateWritingHistory } from "./writingHistory.js";

async function fixture() {
  const events = [createWritingEvent({ previousText: "", nextText: "Hello world", timestampMs: 100 }), createWritingEvent({ previousText: "Hello world", nextText: "Hello earth", timestampMs: 200, forcePaste: true })];
  const submission = { id: "submission", assignment_id: "essay", student_name: "Student", submitted_at: "2026-09-20T00:00:00.000Z", final_text: "Hello earth", event_log_json: JSON.stringify(events.slice(1)), stats_json: JSON.stringify({ finalHtml: "<p>Hello earth</p>", deviceInfo: { country: "UA" } }), paste_events_json: "[]", pause_events_json: "[]" };
  const draft = { studentName: "Student", essayText: "Hello earth", eventLog: events, pasteEvents: [], pauseEvents: [] };
  const row = { assignment_id: "essay", submitted_at: submission.submitted_at, revision: "saved-revision", draft_json: await encodeDraft(draft) };
  return { submission, draft, row, events };
}

test("recovery requires one exact matching submitted draft and preserves a restorable backup", async () => {
  const { submission, row, events } = await fixture();
  const assessment = await assessReplayRecovery(submission, [row]);
  assert.equal(assessment.status, "recoverable");
  const repaired = await prepareReplayRecovery(submission, assessment.candidate);
  const loaded = await decodeSubmissionHistory(repaired.event_log_json);
  assert.deepEqual(loaded, events);
  assert.equal(validateWritingHistory(loaded, submission.final_text).status, "complete");
  const stats = JSON.parse(repaired.stats_json);
  assert.equal(stats.finalHtml, "<p>Hello earth</p>");
  assert.deepEqual(stats.deviceInfo, { country: "UA" });
  assert.equal(stats.characterCount, submission.final_text.length);
  const backup = await decodeDraft(stats.replayRecovery.backup);
  for (const field of ["event_log_json", "stats_json", "paste_events_json", "pause_events_json"]) assert.equal(backup[field], submission[field]);
  assert.equal((await assessReplayRecovery({ ...submission, ...repaired }, [row])).status, "complete");
});

test("missing, ambiguous, mismatched, corrupt and incomplete drafts are left unchanged", async () => {
  const { submission, row, draft } = await fixture();
  assert.equal((await assessReplayRecovery(submission)).status, "unavailable");
  assert.equal((await assessReplayRecovery(submission, [row, { ...row, revision: "other" }])).status, "ambiguous");
  for (const patch of [{ assignment_id: "other" }, { submitted_at: null }, { submitted_at: "different" }, { draft_json: "broken" }]) {
    assert.equal((await assessReplayRecovery(submission, [{ ...row, ...patch }])).status, "unavailable");
  }
  for (const patch of [{ essayText: "different" }, { studentName: "Other student" }, { eventLog: draft.eventLog.slice(1) }]) {
    assert.equal((await assessReplayRecovery(submission, [{ ...row, draft_json: await encodeDraft({ ...draft, ...patch }) }])).status, "unavailable");
  }
});
