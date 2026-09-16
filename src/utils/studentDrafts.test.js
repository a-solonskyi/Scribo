import test from "node:test";
import assert from "node:assert/strict";
import { createDraftSaver, draftKey, storeDraft } from "./studentDrafts.js";
import { encodeDraft, decodeDraft } from "./draftEncoding.js";

const draft = (text) => ({
  studentName: "Student", essayText: text, essayHtml: `<p>${text}</p>`,
  startedAt: 1, eventLog: [], pasteEvents: [], pasteOriginRanges: [], pauseEvents: [],
});

test("account browser backups are isolated by student and essay; the guest key is preserved", () => {
  assert.equal(draftKey("essay"), "scribo-student-draft:essay");
  assert.notEqual(draftKey("essay", "student-1"), draftKey("essay", "student-2"));
  assert.notEqual(draftKey("essay-1", "student"), draftKey("essay-2", "student"));
});

test("storage failures are reported instead of claiming the browser draft is saved", () => {
  const previous = globalThis.window;
  globalThis.window = { localStorage: { setItem() { throw new Error("Quota exceeded"); } } };
  try { assert.equal(storeDraft("draft", draft("essay")), false); }
  finally { globalThis.window = previous; }
});

test("edits made during a save are queued and cannot be marked saved prematurely", async () => {
  const calls = [];
  const statuses = [];
  const backups = [];
  let release;
  const saver = createDraftSaver({
    revision: "original", initialDraft: draft("old"),
    save: async (payload) => {
      calls.push(payload);
      if (calls.length === 1) await new Promise((resolve) => { release = resolve; });
      return { revision: payload.revision };
    },
    persist: (backup) => { backups.push(backup); return true; },
    notify: (status) => statuses.push(status.state),
  });
  try {
    saver.update(draft("first edit"));
    const saving = saver.flush();
    saver.update(draft("latest edit"));
    assert.equal(saver.isDirty(), true);
    release();
    const revision = await saving;
    assert.equal(calls.length, 2);
    assert.equal(calls[1].baseRevision, calls[0].revision);
    assert.equal(calls[1].draft.essayText, "latest edit");
    assert.equal(revision, calls[1].revision);
    assert.equal(backups.at(-1).dirty, false);
    assert.equal(statuses.filter((state) => state === "saved").length, 1);
    assert.equal(saver.isDirty(), false);
  } finally { saver.stop(); }
});

test("a lost save response retries the same revision before saving later edits", async () => {
  const calls = [];
  let reject;
  const saver = createDraftSaver({
    save: async (payload) => {
      calls.push(payload);
      if (calls.length === 1) await new Promise((_resolve, fail) => { reject = fail; });
      return { revision: payload.revision };
    }, persist: () => true, notify: () => {},
  });
  try {
    saver.update(draft("first"));
    const first = saver.flush();
    saver.update(draft("second"));
    reject(new Error("Disconnected"));
    await assert.rejects(first, /Disconnected/);
    await saver.flush();
    assert.equal(calls.length, 3);
    assert.equal(calls[0].revision, calls[1].revision);
    assert.equal(calls[2].baseRevision, calls[1].revision);
    assert.equal(calls[2].draft.essayText, "second");
  } finally { saver.stop(); }
});

test("a conflicting remote revision never gets overwritten automatically", async () => {
  let calls = 0;
  let backup;
  const saver = createDraftSaver({
    save: async () => { calls++; throw Object.assign(new Error("Newer draft"), { status: 409 }); },
    persist: (value) => { backup = value; return true; }, notify: () => {},
  });
  try {
    saver.update(draft("my changes"));
    await assert.rejects(saver.flush(), { status: 409 });
    saver.update(draft("more changes"));
    await assert.rejects(saver.flush(), { status: 409 });
    assert.equal(calls, 1);
    assert.equal(backup.draft.essayText, "more changes");
    assert.equal(backup.dirty, true);
  } finally { saver.stop(); }
});

test("clearing all essay content still saves the empty draft", async () => {
  let saved;
  const initial = draft("remove this text");
  const saver = createDraftSaver({
    initialDraft: initial, revision: "existing",
    save: async (payload) => { saved = payload; return { revision: payload.revision }; },
    persist: () => true, notify: () => {},
  });
  try {
    saver.update({ ...initial, studentName: "", essayText: "", essayHtml: "" });
    await saver.flush();
    assert.equal(saved.draft.essayText, "");
    assert.equal(saved.draft.studentName, "");
  } finally { saver.stop(); }
});

test("compression retains Unicode, formatting, and complete long writing history", async () => {
  const original = draft("Есе — déjà vu 📚");
  original.eventLog = Array.from({ length: 20000 }, (_, i) => ({
    timestamp_ms: i * 100, event_type: "insert", position: i, cursor_position: i + 1,
    inserted_text: "я", deleted_character_count: 0, inserted_origin: "typed", pasted_text: null,
  }));
  const encoded = await encodeDraft(original);
  assert.ok(JSON.stringify(original).length > 1_500_000);
  assert.ok(encoded.length < 1_500_000);
  assert.deepEqual(await decodeDraft(encoded), original);
  assert.deepEqual(await decodeDraft(JSON.stringify(draft("legacy"))), draft("legacy"));
});
