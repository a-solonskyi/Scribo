import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMaxGrade,
  validateScore,
  completeOnTime,
  finalPastedPercent,
  splitStudentName,
  sortGradeRows,
  buildMoodleCsv,
} from './grading.js';
import { createWritingEvent } from './writingAnalytics.js';
import { sameDraft, createDraftSaver } from './studentDrafts.js';
import { validateDraftPayload } from './draftValidation.js';
import { encodeDraft, decodeDraft } from './draftEncoding.js';

test('optional maximum and score boundaries retain zero and reject invalid input', () => {
  for (const value of [null, undefined, ''])
    assert.equal(normalizeMaxGrade(value), null);
  for (const value of [1, 100]) assert.equal(normalizeMaxGrade(value), value);
  for (const value of [0, 101, 1.5, '40', NaN])
    assert.throws(() => normalizeMaxGrade(value));
  for (const value of [0, 25.55, 50])
    assert.equal(validateScore(value, 50), value);
  for (const value of [-1, 51, 0.001, NaN, Infinity, '25'])
    assert.throws(() => validateScore(value, 50));
});
test('grade table uses exact deadline boundary, stable sorting and preserved full-name parts', () => {
  assert.equal(
    completeOnTime('2026-09-30T12:00:00Z', '2026-09-30T15:00:00+03:00'),
    true,
  );
  assert.equal(
    completeOnTime('2026-09-30T12:00:00.001Z', '2026-09-30T12:00:00Z'),
    false,
  );
  assert.equal(completeOnTime('2026-09-30T12:00:00Z', null), true);
  assert.equal(completeOnTime('bad', 'bad'), null);
  assert.deepEqual(splitStudentName('  Олена  де ла Круз '), {
    name: 'Олена',
    surname: 'де ла Круз',
  });
  const rows = [
    { id: 'a', score: null },
    { id: 'b', score: 0 },
    { id: 'c', score: 10 },
  ];
  assert.deepEqual(
    sortGradeRows(rows, 'score').map((r) => r.id),
    ['b', 'c', 'a'],
  );
  assert.deepEqual(
    sortGradeRows(rows, 'score', 'desc').map((r) => r.id),
    ['c', 'b', 'a'],
  );
  assert.equal(rows[0].id, 'a');
});
test('pasted percentage counts surviving pasted text and leaves incomplete evidence unknown', async () => {
  const texts = ['AB', 'ABcd', 'Acd'];
  let before = '';
  const events = texts.map((next, index) => {
    const event = createWritingEvent({
      previousText: before,
      nextText: next,
      timestampMs: index * 100,
      forcePaste: index === 0,
    });
    before = next;
    return { ...event, sequence: index };
  });
  assert.ok(
    Math.abs(
      (await finalPastedPercent('Acd', JSON.stringify(events))) - 100 / 3,
    ) < 1e-10,
  );
  assert.equal(await finalPastedPercent('Acd', '[]'), null);
  assert.equal(await finalPastedPercent('Acd', 'bad'), null);
});
test('Moodle CSV has only identity and grade, preserves case and zero, rejects duplicate identities and formula cells', () => {
  assert.equal(
    buildMoodleCsv([
      { email: ' Student+essay@example.edu ', score: 0 },
      { email: 'é@example.edu', score: 25.5 },
    ]),
    '"Email address","Grade"\r\n"Student+essay@example.edu","0"\r\n"é@example.edu","25.5"\r\n',
  );
  assert.throws(() =>
    buildMoodleCsv([
      { email: 'A@example.edu', score: 1 },
      { email: 'a@example.edu', score: 2 },
    ]),
  );
  for (const email of [
    '=bad@example.edu',
    '+bad@example.edu',
    'bad\n@example.edu',
    'bad',
  ])
    assert.throws(() => buildMoodleCsv([{ email, score: 1 }]));
  assert.throws(() => buildMoodleCsv([]));
});
test('email-only edits autosave without rewriting old draft format and partial addresses survive recovery', async () => {
  const draft = {
    studentName: 'Student',
    essayText: '',
    essayHtml: '',
    eventLog: [],
    pasteEvents: [],
    pasteOriginRanges: [],
    pauseEvents: [],
    startedAt: 1,
  };
  const revision = crypto.randomUUID();
  assert.equal(sameDraft(draft, { ...draft, moodleEmail: '' }), true);
  const partial = { ...draft, moodleEmail: 'student@' };
  assert.equal(sameDraft(draft, partial), false);
  assert.equal(
    validateDraftPayload({ draft: partial, revision, baseRevision: null }),
    null,
  );
  assert.deepEqual(await decodeDraft(await encodeDraft(partial)), partial);
  let saved;
  const saver = createDraftSaver({
    initialDraft: draft,
    revision,
    save: async (payload) => {
      saved = payload;
      return { revision: payload.revision };
    },
    persist: () => true,
    notify: () => {},
  });
  saver.update(partial);
  await saver.flush();
  saver.stop();
  assert.equal(saved.draft.moodleEmail, 'student@');
});
