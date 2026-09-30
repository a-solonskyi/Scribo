import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { createWritingEvent } from '../src/utils/writingAnalytics.js';
import { decodeDraft } from '../src/utils/draftEncoding.js';
const [origin, databasePath] = process.argv.slice(2);
if (
  !origin ||
  !['127.0.0.1', 'localhost'].includes(new URL(origin).hostname) ||
  !databasePath
)
  throw Error('Use a local preview and its SQLite file.');
const db = new DatabaseSync(databasePath);
db.exec('PRAGMA foreign_keys=ON');
const tables = [
  'approved_professors',
  'classes',
  'assignments',
  'submissions',
  'student_drafts',
  'response_annotations',
];
const fingerprint = () =>
  createHash('sha256')
    .update(
      JSON.stringify(
        tables.map((t) => db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all()),
      ),
    )
    .digest('hex');
const original = fingerprint(),
  id = crypto.randomUUID(),
  other = crypto.randomUUID(),
  owner = 'local_seedy',
  now = new Date().toISOString();
const existed = db
  .prepare('SELECT 1 FROM approved_professors WHERE user_id=?')
  .get(owner);
const headers = {
  'content-type': 'application/json',
  cookie: '__sites_local_auth=1',
};
let checks = 0;
async function call(path, options = {}, status = 200) {
  const res = await fetch(origin + path, { headers, ...options });
  const text = await res.text();
  assert.equal(res.status, status, text.slice(0, 500));
  checks++;
  return res.headers.get('content-type')?.startsWith('text/csv')
    ? text
    : JSON.parse(text);
}
const post = (path, body, status = 200) =>
  call(path, { method: 'POST', body: JSON.stringify(body) }, status);
const score = (submission, body, status = 200) =>
  call(
    `/api/submissions/${submission}/grade`,
    { method: 'PUT', body: JSON.stringify(body) },
    status,
  );
const finalText = 'ABC def';
const events = [
  {
    ...createWritingEvent({
      previousText: '',
      nextText: finalText,
      timestampMs: 100,
      forcePaste: true,
    }),
    sequence: 0,
  },
];
try {
  if (!existed)
    db.prepare('INSERT INTO approved_professors VALUES (?,?,?,?)').run(
      owner,
      'seedy@sites.test',
      'Local test',
      now,
    );
  for (const [key, professor] of [
    [id, owner],
    [other, 'other-professor'],
  ])
    db.prepare(
      'INSERT INTO classes(id,professor_id,name,created_at) VALUES (?,?,?,?)',
    ).run(key, professor, 'Grading fixture', now);
  for (const value of [0, 101, 1.2, '50'])
    await post(
      `/api/classes/${id}/assignments`,
      { topic: 'Invalid', max_grade: value },
      400,
    );
  const legacy = await post(
    `/api/classes/${id}/assignments`,
    { topic: 'Legacy form' },
    201,
  );
  const low = await post(
    `/api/classes/${id}/assignments`,
    { topic: 'One point', max_grade: 1 },
    201,
  );
  const assignment = await post(
    `/api/classes/${id}/assignments`,
    { topic: 'Graded essay', max_grade: 50, deadline: '2026-09-30T12:00:00Z' },
    201,
  );
  const high = await post(
    `/api/classes/${id}/assignments`,
    { topic: '100 points', max_grade: 100 },
    201,
  );
  assert.equal(low.max_grade, 1);
  assert.equal(high.max_grade, 100);
  assert.equal(legacy.max_grade, null);
  assert.equal(
    (await call(`/api/write/${legacy.public_token}`, { headers: {} }))
      .max_grade,
    null,
  );
  assert.equal(
    (await call(`/api/write/${assignment.public_token}`, { headers: {} }))
      .max_grade,
    50,
  );
  const base = {
    student_name: 'Олена Коваль',
    final_text: finalText,
    event_log_json: events,
    stats_json: {},
    paste_events_json: [],
    pause_events_json: [],
  };
  await post('/api/submissions', { ...base, assignment_id: legacy.id }, 201);
  const legacySubmission = db
    .prepare('SELECT id FROM submissions WHERE assignment_id=?')
    .get(legacy.id).id;
  assert.equal(
    (await call(`/api/submissions/${legacySubmission}/grade`))
      .effective_max_grade,
    100,
  );
  await post(
    '/api/submissions',
    { ...base, assignment_id: assignment.id },
    400,
  );
  await post(
    '/api/submissions',
    { ...base, assignment_id: assignment.id, moodle_email: 'bad' },
    400,
  );
  assert.equal(
    db
      .prepare('SELECT count(*) AS n FROM submissions WHERE assignment_id=?')
      .get(assignment.id).n,
    0,
  );
  await post(
    '/api/submissions',
    {
      ...base,
      assignment_id: assignment.id,
      moodle_email: 'Student@example.edu',
    },
    201,
  );
  const submission = db
    .prepare('SELECT id FROM submissions WHERE assignment_id=?')
    .get(assignment.id).id;
  assert.equal(
    db
      .prepare(
        'SELECT email FROM submission_moodle_emails WHERE submission_id=?',
      )
      .get(submission).email,
    'Student@example.edu',
  );
  const draft = {
    studentName: 'Account Student',
    moodleEmail: 'account@example.edu',
    essayText: finalText,
    essayHtml: '<p>ABC def</p>',
    eventLog: events,
    pasteEvents: [],
    pasteOriginRanges: [],
    pauseEvents: [],
    startedAt: 1,
  };
  const revision = crypto.randomUUID();
  await call(`/api/write/${assignment.public_token}/draft`, {
    method: 'PUT',
    body: JSON.stringify({
      expectedUserId: owner,
      draft,
      revision,
      baseRevision: null,
    }),
  });
  assert.equal(
    (
      await decodeDraft(
        db
          .prepare(
            'SELECT draft_json FROM student_drafts WHERE assignment_id=?',
          )
          .get(assignment.id).draft_json,
      )
    ).moodleEmail,
    draft.moodleEmail,
  );
  const accountPayload = {
    ...base,
    assignment_id: assignment.id,
    student_name: draft.studentName,
    student_draft_revision: revision,
    expected_user_id: owner,
    moodle_email: 'tampered@example.edu',
  };
  await post('/api/submissions', accountPayload, 201);
  await post('/api/submissions', accountPayload);
  const accountSub = db
    .prepare(
      'SELECT id FROM submissions WHERE assignment_id=? AND student_name=?',
    )
    .get(assignment.id, draft.studentName).id;
  assert.equal(
    db
      .prepare(
        'SELECT email FROM submission_moodle_emails WHERE submission_id=?',
      )
      .get(accountSub).email,
    draft.moodleEmail,
  );
  assert.equal(
    db
      .prepare('SELECT count(*) n FROM submissions WHERE assignment_id=?')
      .get(assignment.id).n,
    2,
  );
  const foreign = crypto.randomUUID();
  db.prepare(
    'INSERT INTO assignments(id,class_id,professor_id,topic,public_token,created_at) VALUES (?,?,?,?,?,?)',
  ).run(foreign, other, 'other-professor', 'Other', foreign, now);
  db.prepare(
    'INSERT INTO submissions(id,assignment_id,student_name,final_text,stats_json,event_log_json,paste_events_json,pause_events_json,submitted_at) VALUES (?,?,?,?,?,?,?,?,?)',
  ).run(foreign, foreign, 'Other', 'X', '{}', '[]', '[]', '[]', now);
  for (const path of [
    `/api/submissions/${submission}/grade`,
    `/api/assignments/${assignment.id}/grades`,
  ])
    await call(path, { headers: {} }, 401);
  for (const path of [
    `/api/submissions/${foreign}/grade`,
    `/api/assignments/${foreign}/grades`,
  ])
    await call(path, {}, 404);
  await score(
    foreign,
    { score: 1, base_revision: 0, request_id: crypto.randomUUID() },
    404,
  );
  await post(
    `/api/assignments/${foreign}/grades/moodle-export`,
    { entries: [] },
    404,
  );
  const before = fingerprint();
  for (const value of [-1, 51, 1.234, '5'])
    await score(
      submission,
      { score: value, base_revision: 0, request_id: crypto.randomUUID() },
      400,
    );
  const request = {
    score: 0,
    base_revision: 0,
    request_id: crypto.randomUUID(),
  };
  assert.equal((await score(submission, request)).score, 0);
  assert.equal((await score(submission, request)).revision, 1);
  await score(
    submission,
    { score: 40, base_revision: 0, request_id: crypto.randomUUID() },
    409,
  );
  assert.equal(
    (
      await score(submission, {
        score: 40,
        base_revision: 1,
        request_id: crypto.randomUUID(),
      })
    ).revision,
    2,
  );
  assert.deepEqual(
    db
      .prepare(
        'SELECT score FROM submission_grades WHERE submission_id=? ORDER BY revision',
      )
      .all(submission)
      .map((x) => x.score),
    [0, 40],
  );
  const outcomes = await Promise.all(
    [1, 2].map((scoreValue) =>
      fetch(origin + `/api/submissions/${accountSub}/grade`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          score: scoreValue,
          base_revision: 0,
          request_id: crypto.randomUUID(),
        }),
      }).then((r) => r.status),
    ),
  );
  assert.deepEqual(
    outcomes.sort((a, b) => a - b),
    [200, 409],
  );
  await score(accountSub, {
    score: 0,
    base_revision: 1,
    request_id: crypto.randomUUID(),
  });
  const grades = await call(`/api/assignments/${assignment.id}/grades`);
  assert.equal(grades.rows.length, 2);
  assert.equal(
    grades.rows.find((r) => r.id === submission).pasted_percent,
    100,
  );
  assert.equal(
    grades.rows.find((r) => r.id === submission).email,
    'Student@example.edu',
  );
  const exportPath = `/api/assignments/${assignment.id}/grades/moodle-export`;
  const entry = {
    submission_id: submission,
    revision: 2,
    email: 'Student@example.edu',
  };
  await post(exportPath, { entries: [{ ...entry, revision: 1 }] }, 409);
  await post(
    exportPath,
    {
      entries: [
        {
          submission_id: legacySubmission,
          revision: 0,
          email: 'legacy@example.edu',
        },
      ],
    },
    409,
  );
  await post(
    exportPath,
    {
      entries: [
        entry,
        {
          submission_id: accountSub,
          revision: 2,
          email: 'student@example.edu',
        },
      ],
    },
    400,
  );
  await call(
    exportPath,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entries: [entry] }),
    },
    401,
  );
  const csv = await post(exportPath, {
    entries: [
      entry,
      { submission_id: accountSub, revision: 2, email: draft.moodleEmail },
    ],
  });
  assert.equal(
    csv,
    '"Email address","Grade"\r\n"Student@example.edu","40"\r\n"account@example.edu","0"\r\n',
  );
  assert.equal(
    fingerprint(),
    before,
    'Grading/export changed existing records',
  );
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  console.log(
    JSON.stringify({
      status: 'passed',
      checks,
      concurrentGradeProtection: true,
      appendOnlyGradeHistory: true,
      emailFromAcknowledgedDraft: true,
      existingRecordsUnchanged: true,
    }),
  );
} finally {
  db.prepare('DELETE FROM classes WHERE id IN (?,?)').run(id, other);
  if (!existed)
    db.prepare('DELETE FROM approved_professors WHERE user_id=?').run(owner);
  assert.equal(
    fingerprint(),
    original,
    'Fixture cleanup changed original records',
  );
  db.close();
}
