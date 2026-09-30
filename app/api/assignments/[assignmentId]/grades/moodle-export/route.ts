import { getRawDb } from '@/db';
import {
  errorResponse,
  getOwnedAssignment,
  readJsonObject,
} from '@/lib/server/data';
import { requireApprovedProfessor } from '@/lib/server/professor';
import { latestGradeJoin } from '@/lib/server/grading';
import { buildMoodleCsv, normalizeMoodleEmail } from '@/src/utils/grading';
type Context = { params: Promise<{ assignmentId: string }> };
export async function POST(request: Request, { params }: Context) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse('Professor access required.', 401);
  const { assignmentId } = await params;
  if (!(await getOwnedAssignment(professor.userId, assignmentId)))
    return errorResponse('Essay not found.', 404);
  const body = await readJsonObject(request);
  if (
    !Array.isArray(body.entries) ||
    !body.entries.length ||
    body.entries.length > 500
  )
    return errorResponse(
      'Select between 1 and 500 graded submissions per export.',
    );
  const db = getRawDb();
  const { results } = await db
    .prepare(
      `SELECT s.id, g.score, g.revision FROM submissions s ${latestGradeJoin} WHERE s.assignment_id = ?`,
    )
    .bind(assignmentId)
    .all<{ id: string; score: number | null; revision: number | null }>();
  const available = new Map(results.map((row) => [row.id, row])),
    ids = new Set();
  const rows: Array<{ id: string; email: string; score: number }> = [];
  for (const entry of body.entries) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof entry.submission_id !== 'string' ||
      ids.has(entry.submission_id)
    )
      return errorResponse('Invalid or duplicate submission selection.');
    const row = available.get(entry.submission_id);
    if (!row || row.score === null)
      return errorResponse(
        'A selected submission is unavailable or has not been graded.',
        409,
      );
    if (entry.revision !== row.revision)
      return errorResponse(
        'A selected grade changed. Close the export, refresh Grades and review it before exporting.',
        409,
      );
    let email: string;
    try {
      email = normalizeMoodleEmail(entry.email);
    } catch (e) {
      return errorResponse(e instanceof Error ? e.message : 'Invalid email.');
    }
    ids.add(row.id);
    rows.push({ id: row.id, email, score: row.score });
  }
  let csv: string;
  try {
    csv = buildMoodleCsv(rows);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Unable to export.');
  }
  // Only new contact mappings are written; essays, feedback and grades are untouched.
  await db.batch(
    rows.map((row) =>
      db
        .prepare(`INSERT INTO submission_moodle_emails (submission_id, email, updated_at)
    VALUES (?, ?, ?) ON CONFLICT(submission_id) DO UPDATE SET email = excluded.email, updated_at = excluded.updated_at`)
        .bind(row.id, row.email, new Date().toISOString()),
    ),
  );
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="moodle-grades.csv"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
