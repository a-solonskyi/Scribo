// Local-only release checks. Raw records are compared before/after reads and
// all synthetic fixtures are removed. Never accepts a production origin.
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdtempSync, copyFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWritingEvent } from "../src/utils/writingAnalytics.js";
import { encodeDraft } from "../src/utils/draftEncoding.js";
import { getPasteRangesForText } from "../src/utils/pasteHighlighting.js";

const [origin, databasePath] = process.argv.slice(2);
if (!origin || !["127.0.0.1", "localhost"].includes(new URL(origin).hostname) || !databasePath) throw new Error("Use a localhost preview and its local SQLite file.");
const db = new DatabaseSync(databasePath);
const tables = ["approved_professors", "classes", "assignments", "submissions", "student_drafts", "response_annotations"];
function fingerprint(connection) {
  const hash = createHash("sha256");
  for (const table of tables) hash.update(JSON.stringify(connection.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()));
  return hash.digest("hex");
}
const originalFingerprint = fingerprint(db);
const backupDirectory = mkdtempSync(join(tmpdir(), "skribo-p1-local-restore-"));
const backupPath = join(backupDirectory, "backup.sqlite");
db.prepare("VACUUM INTO ?").run(backupPath);
chmodSync(backupPath, 0o600);
const restoredPath = join(backupDirectory, "restored.sqlite");
copyFileSync(backupPath, restoredPath);
chmodSync(restoredPath, 0o600);
const restored = new DatabaseSync(restoredPath, { readOnly: true });
assert.equal(fingerprint(restored), originalFingerprint);
restored.close();

const id = crypto.randomUUID();
const legacyId = crypto.randomUUID();
const annotationId = crypto.randomUUID();
const owner = "local_seedy";
const now = new Date().toISOString();
const headers = { "content-type": "application/json", cookie: "__sites_local_auth=1" };
const existingApproval = db.prepare("SELECT user_id FROM approved_professors WHERE user_id=?").get(owner);
let checks = 1;
function passed(name) { checks++; console.log(JSON.stringify({ name, passed: true })); }
async function request(path, options = {}, expected = 200) {
  const response = await fetch(origin + path, options);
  const text = await response.text();
  assert.equal(response.status, expected, text.slice(0, 300));
  return JSON.parse(text);
}
const post = (payload, expected = 201) => request("/api/submissions", { method: "POST", headers, body: JSON.stringify(payload) }, expected);
const save = (payload, expected = 200) => request(`/api/write/${id}/draft`, { method: "PUT", headers, body: JSON.stringify({ expectedUserId: owner, ...payload }) }, expected);

try {
  if (!existingApproval) db.prepare("INSERT INTO approved_professors (user_id,email,created_at) VALUES (?,?,?)").run(owner, "seedy@sites.test", now);
  db.prepare("INSERT INTO classes (id,professor_id,name,created_at) VALUES (?,?,?,?)").run(id, owner, "P1 preservation fixture", now);
  db.prepare("INSERT INTO assignments (id,class_id,professor_id,topic,public_token,created_at) VALUES (?,?,?,?,?,?)").run(id, id, owner, "P1 preservation fixture", id, now);

  const rawStats = JSON.stringify({ wordCount: 999, pasteDetectionVersion: 2, pasteOriginRanges: [null], finalHtml: "<p>A different essay</p>", deviceInfo: { ip: {} } });
  const rawText = "A📚\n\nЕсе";
  db.prepare("INSERT INTO submissions (id,assignment_id,student_name,final_text,stats_json,event_log_json,paste_events_json,pause_events_json,submitted_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(legacyId, id, "Legacy fixture", rawText, rawStats, "[]", '[null,{"pasted_text":{}}]', '{"malformed":true}', now);
  db.prepare("INSERT INTO response_annotations (id,submission_id,professor_id,type,start_offset,end_offset,text_quote,comment_text,color,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run(annotationId, legacyId, owner, "comment", 1, 3, "📚", "Keep this comment", "yellow", now, now);
  const beforeRead = db.prepare("SELECT * FROM submissions WHERE id=?").get(legacyId);
  const legacy = await request(`/api/submissions/${legacyId}`, { headers });
  assert.equal(legacy.stats_json.wordCount, 999); // Never rewrite historical metrics.
  assert.equal(legacy.final_text, rawText);
  assert.equal(legacy.replay_integrity.status, "incomplete");
  assert.deepEqual(legacy.stats_json.pasteOriginRanges, []);
  assert.deepEqual(legacy.pause_events_json, []);
  assert.equal(legacy.recorded_metadata.stats_json.finalHtml, "<p>A different essay</p>");
  assert.deepEqual(legacy.recorded_metadata.stats_json.pasteOriginRanges, [null]);
  assert.doesNotThrow(() => getPasteRangesForText(rawText, legacy.paste_events_json, [], legacy.stats_json.pasteOriginRanges));
  assert.deepEqual(db.prepare("SELECT * FROM submissions WHERE id=?").get(legacyId), beforeRead);
  const annotations = await request(`/api/submissions/${legacyId}/annotations`, { headers });
  assert.equal(rawText.slice(annotations[0].start_offset, annotations[0].end_offset), "📚");
  assert.equal(annotations[0].comment_text, "Keep this comment");
  passed("Malformed legacy reads preserve every stored field and existing Unicode annotations");

  const essay = "Synthetic audit essay.";
  const event = createWritingEvent({ previousText: "", nextText: essay, timestampMs: 1000 });
  const payload = { assignment_id: id, student_name: "New fixture", final_text: essay, event_log_json: [event], stats_json: { wordCount: 987654, finalHtml: "<p>Wrong essay</p>", pasteDetectionVersion: 2, pasteOriginRanges: [null], replayRecovery: { recoveredAt: "fabricated" } }, paste_events_json: [null, { pasted_text: "Forged clipboard", character_count: 987654 }], pause_events_json: {} };
  await post(payload);
  const list = await request(`/api/assignments/${id}/submissions`, { headers });
  const fresh = list.find(row => row.student_name === "New fixture");
  assert.equal(fresh.stats_json.wordCount, 3);
  assert.equal(fresh.stats_json.analyticsVersion, 1);
  assert.equal(fresh.stats_json.pasteEventCount, 0);
  assert.deepEqual(fresh.paste_events_json, []);
  assert.deepEqual(fresh.pause_events_json, []);
  assert.equal(fresh.recorded_metadata.paste_events_json[1].character_count, 987654);
  assert.equal(fresh.stats_json.replayRecovery, undefined);
  assert.equal(fresh.replay_integrity.status, "complete");
  assert.deepEqual(fresh.event_log_json, [event]);
  assert.deepEqual(fresh.recorded_metadata.pause_events_json, {});
  passed("New submission computes counts, preserves raw events and safely projects malformed metadata");

  const events = Array.from({ length: 6000 }, (_, index) => ({ event_type: "insert", position: index, inserted_text: "a", timestamp_ms: index * 300 }));
  const draft = { studentName: "Old open tab", essayText: "a".repeat(6000), essayHtml: `<p>${"a".repeat(6000)}</p>`, eventLog: events, pasteEvents: [], pauseEvents: [], pasteOriginRanges: [], startedAt: Date.now() };
  const revision = crypto.randomUUID();
  await save({ draft, revision, baseRevision: null });
  const rowBefore = db.prepare("SELECT * FROM student_drafts WHERE assignment_id=?").get(id);
  const oldPayload = { assignment_id: id, student_name: draft.studentName, final_text: draft.essayText, event_log_json: events.slice(-4000), expected_user_id: owner, student_draft_revision: revision, stats_json: { finalHtml: "<p>Forged</p>" } };
  await post({ ...oldPayload, client_version: 999 }, 409);
  const mismatch = await post({ ...oldPayload, event_log_json: events.slice(-3999) }, 409);
  assert.equal(mismatch.code, "draft_content_mismatch");
  await post({ ...oldPayload, student_draft_revision: crypto.randomUUID() }, 409);
  await post({ ...oldPayload, expected_user_id: "another-account" }, 401);
  assert.deepEqual(db.prepare("SELECT * FROM student_drafts WHERE assignment_id=?").get(id), rowBefore);
  passed("Unsupported, arbitrary, stale and wrong-account requests leave the in-progress draft untouched");

  for (const [field, value] of [["essayHtml", "x".repeat(500001)], ["startedAt", "invalid"], ["pasteOriginRanges", {}]]) {
    const error = await save({ draft: { ...draft, [field]: value }, revision: crypto.randomUUID(), baseRevision: revision }, 400);
    assert.equal(error.field, field);
    assert.ok(error.requestId);
  }
  assert.deepEqual(db.prepare("SELECT * FROM student_drafts WHERE assignment_id=?").get(id), rowBefore);
  passed("Field-specific failed saves preserve the complete last acknowledged draft");

  await post(oldPayload);
  await post(oldPayload, 200); // A response lost after commit must not duplicate.
  const oldRows = (await request(`/api/assignments/${id}/submissions`, { headers })).filter(row => row.student_name === draft.studentName);
  assert.equal(oldRows.length, 1);
  assert.equal(oldRows[0].event_log_json.length, 6000);
  assert.deepEqual(oldRows[0].event_log_json, events);
  assert.equal(oldRows[0].stats_json.finalHtml, draft.essayHtml);
  assert.equal(oldRows[0].replay_integrity.status, "complete");
  const afterSubmit = db.prepare("SELECT * FROM student_drafts WHERE assignment_id=?").get(id);
  assert.equal(afterSubmit.draft_json, rowBefore.draft_json);
  assert.equal(afterSubmit.revision, rowBefore.revision);
  assert.ok(afterSubmit.submitted_at);
  passed("Exact legacy tab submission uses all 6000 saved events and retry creates one record");

  // A legacy guest has no complete server draft to recover from. Keep the
  // received evidence and truthful incomplete status instead of inventing it.
  await post({ assignment_id: id, student_name: "Legacy guest", final_text: draft.essayText, event_log_json: events.slice(-4000) });
  const guest = (await request(`/api/assignments/${id}/submissions`, { headers })).find(row => row.student_name === "Legacy guest");
  assert.equal(guest.event_log_json.length, 4000);
  assert.equal(guest.replay_integrity.status, "incomplete");
  assert.equal(guest.final_text, draft.essayText);
  passed("Incomplete guest evidence and essay are preserved without fabricating recovery");

  // Keep both supported draft storage formats readable without a migration.
  const archived = await encodeDraft(draft);
  db.prepare("UPDATE student_drafts SET draft_json=? WHERE assignment_id=?").run(JSON.stringify(draft), id);
  const plain = await request(`/api/write/${id}/draft`, { headers });
  assert.deepEqual(plain.draft, draft);
  db.prepare("UPDATE student_drafts SET draft_json=? WHERE assignment_id=?").run(archived, id);
  const gzip = await request(`/api/write/${id}/draft`, { headers });
  assert.deepEqual(gzip.draft, draft);
  passed("Both legacy JSON and gzip account drafts remain readable without data migration");

  // Reopen only this synthetic fixture to exercise two live HTTP writers.
  db.prepare("UPDATE student_drafts SET submitted_at=NULL WHERE assignment_id=?").run(id);
  const contenders = [" A", " B"].map((suffix) => ({
    expectedUserId: owner, revision: crypto.randomUUID(), baseRevision: revision,
    draft: { ...draft, essayText: draft.essayText + suffix, essayHtml: `<p>${draft.essayText + suffix}</p>`,
      eventLog: [...events, createWritingEvent({ previousText: draft.essayText, nextText: draft.essayText + suffix, timestampMs: 1_800_000 })] },
  }));
  const responses = await Promise.all(contenders.map(body => fetch(origin + `/api/write/${id}/draft`, { method: "PUT", headers, body: JSON.stringify(body) })));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  const winnerIndex = responses.findIndex(response => response.status === 200);
  const winner = contenders[winnerIndex];
  const loser = contenders[1 - winnerIndex];
  const winningRow = db.prepare("SELECT * FROM student_drafts WHERE assignment_id=?").get(id);
  assert.equal(winningRow.revision, winner.revision);
  const savedWinner = await request(`/api/write/${id}/draft`, { headers });
  assert.deepEqual(savedWinner.draft, winner.draft);
  await save(winner); // Same revision after a lost response is idempotent.
  await save(loser, 409);
  assert.deepEqual(db.prepare("SELECT * FROM student_drafts WHERE assignment_id=?").get(id), winningRow);
  passed("Two simultaneous tabs cannot overwrite each other; repeating a committed save is idempotent");
} finally {
  db.prepare("DELETE FROM response_annotations WHERE submission_id IN (SELECT id FROM submissions WHERE assignment_id=?)").run(id);
  db.prepare("DELETE FROM submissions WHERE assignment_id=?").run(id);
  db.prepare("DELETE FROM student_drafts WHERE assignment_id=?").run(id);
  db.prepare("DELETE FROM assignments WHERE id=?").run(id);
  db.prepare("DELETE FROM classes WHERE id=?").run(id);
  if (!existingApproval) db.prepare("DELETE FROM approved_professors WHERE user_id=?").run(owner);
  assert.equal(fingerprint(db), originalFingerprint, "Existing local records changed");
  db.close();
}
console.log(JSON.stringify({ checks, status: "passed", preexistingRecordsUnchanged: true, localBackupRestored: true, productionBackupVerified: false }));
