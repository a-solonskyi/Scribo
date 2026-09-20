// Integration check against a running LOCAL preview and its D1 SQLite file.
// Creates isolated fixtures and removes only those fixtures in finally.
// node scripts/test-writing-submissions.mjs http://127.0.0.1:3000 /path/to/local.sqlite
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createWritingEvent } from "../src/utils/writingAnalytics.js";
import { replayUntil } from "../src/utils/replayEngine.js";
import { decodeSubmissionHistory } from "../src/utils/submissionHistory.js";
import { decodeDraft } from "../src/utils/draftEncoding.js";

const [origin, databasePath] = process.argv.slice(2);
if (!origin || !["127.0.0.1", "localhost"].includes(new URL(origin).hostname) || !databasePath) {
  throw new Error("Provide a local preview URL and its local SQLite database path.");
}
const db = new DatabaseSync(databasePath);
const id = crypto.randomUUID();
// The Sites dev plugin strips identity headers and supplies this fixed mock
// identity from its local-only cookie. Existing approval is left untouched.
const professor = "local_seedy";
const student = "local_seedy";
const existingApproval = db.prepare("SELECT user_id FROM approved_professors WHERE user_id=?").get(professor);
const headers = () => ({ "content-type": "application/json", cookie: "__sites_local_auth=1" });
const now = new Date().toISOString();
let checks = 0;
async function request(path, options = {}, expected = 200) {
  const response = await fetch(origin + path, options);
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  return data;
}
let text = "";
const events = [];
function change(next, forcePaste = false) {
  events.push({ ...createWritingEvent({ previousText: text, nextText: next, timestampMs: events.length * 300, forcePaste }), sequence: events.length });
  text = next;
}
for (let index = 0; index < 5000; index++) change(text + String.fromCharCode(97 + index % 26));
change("Intro 📚\n\n" + text.slice(20), true);
change(text + "!");
const payload = { assignment_id: id, student_name: "Replay test", final_text: text, event_log_json: events, stats_json: {}, paste_events_json: [], pause_events_json: [] };

try {
  if (!existingApproval) db.prepare("INSERT INTO approved_professors (user_id,email,created_at) VALUES (?,?,?)").run(professor, "seedy@sites.test", now);
  db.prepare("INSERT INTO classes (id,professor_id,name,created_at) VALUES (?,?,?,?)").run(id, professor, "Replay integration fixture", now);
  db.prepare("INSERT INTO assignments (id,class_id,professor_id,topic,public_token,created_at) VALUES (?,?,?,?,?,?)").run(id, id, professor, "Replay integration fixture", id, now);

  await request("/api/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }, 201);
  let rows = await request(`/api/assignments/${id}/submissions`, { headers: headers(professor) });
  assert.equal(rows.length, 1);
  const guest = await request(`/api/submissions/${rows[0].id}`, { headers: headers(professor) });
  assert.deepEqual(guest.event_log_json, events);
  assert.equal(guest.final_text, text);
  assert.equal(guest.replay_integrity.status, "complete");
  assert.equal(replayUntil(guest.event_log_json, Infinity).text, text);
  const stored = db.prepare("SELECT event_log_json FROM submissions WHERE id=?").get(guest.id);
  assert.ok(stored.event_log_json.startsWith("writing-history-v1:"));
  assert.deepEqual(await decodeSubmissionHistory(stored.event_log_json), events);
  checks++;

  const revision = crypto.randomUUID();
  const draft = { studentName: "Replay test", essayText: text, essayHtml: "<p>Fixture</p>", eventLog: events, pasteEvents: [], pasteOriginRanges: [], pauseEvents: [], startedAt: Date.now() - 1_600_000 };
  await request(`/api/write/${id}/draft`, { method: "PUT", headers: headers(student), body: JSON.stringify({ expectedUserId: student, draft, revision, baseRevision: null }) });
  const accountPayload = { ...payload, expected_user_id: student, student_draft_revision: revision };
  await request("/api/submissions", { method: "POST", headers: headers(student), body: JSON.stringify({ ...accountPayload, final_text: "stale" }) }, 409);
  await request("/api/submissions", { method: "POST", headers: headers(student), body: JSON.stringify(accountPayload) }, 201);
  await request("/api/submissions", { method: "POST", headers: headers(student), body: JSON.stringify(accountPayload) });
  rows = await request(`/api/assignments/${id}/submissions`, { headers: headers(professor) });
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.replay_integrity.status, "complete");
    assert.deepEqual(row.event_log_json, events);
  }
  assert.ok(db.prepare("SELECT submitted_at FROM student_drafts WHERE assignment_id=? AND user_id=?").get(id, student).submitted_at);
  checks++;

  await request("/api/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, student_name: "Damaged history", event_log_json: events.slice(1) }) }, 201);
  rows = await request(`/api/assignments/${id}/submissions`, { headers: headers(professor) });
  const incomplete = rows.find((row) => row.student_name === "Damaged history");
  assert.equal(incomplete.final_text, text);
  assert.equal(incomplete.replay_integrity.status, "incomplete");
  assert.equal(incomplete.event_log_json.length, events.length - 1);
  checks++;

  // Existing plain JSON rows must still work after the storage-format change.
  db.prepare("UPDATE submissions SET event_log_json=? WHERE id=?").run(JSON.stringify(events), guest.id);
  const legacy = await request(`/api/submissions/${guest.id}`, { headers: headers(professor) });
  assert.equal(legacy.replay_integrity.status, "complete");
  assert.deepEqual(legacy.event_log_json, events);
  await request(`/api/submissions/${guest.id}`, {}, 401);
  checks++;

  const accountRow = db.prepare("SELECT * FROM submissions WHERE assignment_id=? AND id<>? AND student_name=?").get(id, guest.id, "Replay test");
  const damagedEvents = JSON.stringify(events.slice(-4000));
  db.prepare("UPDATE submissions SET event_log_json=? WHERE id=?").run(damagedEvents, accountRow.id);
  let cursor = null;
  let candidate;
  do {
    const page = await request(`/api/replay-recovery${cursor ? `?after=${encodeURIComponent(cursor)}` : ""}`, { headers: headers(professor) });
    candidate ||= page.items.find((item) => item.id === accountRow.id);
    cursor = page.nextCursor;
  } while (cursor);
  assert.equal(candidate.status, "recoverable");
  await request("/api/replay-recovery", {}, 401);
  await request("/api/replay-recovery", { method: "POST", headers: headers(professor), body: JSON.stringify({ submissionId: "missing" }) }, 404);
  const recovered = await request("/api/replay-recovery", { method: "POST", headers: headers(professor), body: JSON.stringify({ submissionId: accountRow.id }) });
  assert.equal(recovered.status, "recovered");
  const restored = await request(`/api/submissions/${accountRow.id}`, { headers: headers(professor) });
  assert.equal(restored.replay_integrity.status, "complete");
  assert.deepEqual(restored.event_log_json, events);
  assert.equal(restored.stats_json.replayRecovery.backup, undefined);
  const stats = JSON.parse(db.prepare("SELECT stats_json FROM submissions WHERE id=?").get(accountRow.id).stats_json);
  assert.equal((await decodeDraft(stats.replayRecovery.backup)).event_log_json, damagedEvents);
  const repeat = await request("/api/replay-recovery", { method: "POST", headers: headers(professor), body: JSON.stringify({ submissionId: accountRow.id }) });
  assert.equal(repeat.status, "complete");
  checks++;
  console.log(JSON.stringify({ integrationChecks: checks, status: "passed", eventsPerSubmission: events.length }));
} finally {
  db.prepare("DELETE FROM submissions WHERE assignment_id=?").run(id);
  db.prepare("DELETE FROM student_drafts WHERE assignment_id=?").run(id);
  db.prepare("DELETE FROM assignments WHERE id=?").run(id);
  db.prepare("DELETE FROM classes WHERE id=?").run(id);
  if (!existingApproval) db.prepare("DELETE FROM approved_professors WHERE user_id=?").run(professor);
  db.close();
}
