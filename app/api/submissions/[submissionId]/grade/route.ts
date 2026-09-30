import { getRawDb } from '@/db';
import {
  errorResponse,
  getOwnedSubmission,
  readJsonObject,
} from '@/lib/server/data';
import { requireApprovedProfessor } from '@/lib/server/professor';
import {
  getCurrentGrade,
  getMaxGrade,
  serializeGrade,
  type GradeRow,
} from '@/lib/server/grading';
import { validateScore } from '@/src/utils/grading';
type Context = { params: Promise<{ submissionId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse('Professor access required.', 401);
  const { submissionId } = await params;
  const owned = await getOwnedSubmission(professor.userId, submissionId);
  if (!owned) return errorResponse('Submission not found.', 404);
  const [grade, maxGrade] = await Promise.all([
    getCurrentGrade(submissionId),
    getMaxGrade(owned.assignment.id),
  ]);
  return Response.json(serializeGrade(grade, maxGrade));
}
export async function PUT(request: Request, { params }: Context) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse('Professor access required.', 401);
  const { submissionId } = await params;
  const owned = await getOwnedSubmission(professor.userId, submissionId);
  if (!owned) return errorResponse('Submission not found.', 404);
  const body = await readJsonObject(request),
    maxGrade = await getMaxGrade(owned.assignment.id);
  let score: number;
  try {
    score = validateScore(body.score, maxGrade ?? 100);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Invalid grade.');
  }
  if (
    !Number.isSafeInteger(body.base_revision) ||
    Number(body.base_revision) < 0 ||
    typeof body.request_id !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(body.request_id)
  )
    return errorResponse(
      'Invalid grade revision. Reload the grade and try again.',
    );
  const db = getRawDb(),
    revision = Number(body.base_revision) + 1;
  const previousRequest = await db
    .prepare('SELECT * FROM submission_grades WHERE id = ?')
    .bind(body.request_id)
    .first<GradeRow>();
  if (previousRequest) {
    if (
      previousRequest.submission_id !== submissionId ||
      previousRequest.graded_by !== professor.userId ||
      previousRequest.score !== score ||
      previousRequest.revision !== revision
    )
      return errorResponse(
        'This grade request conflicts with an earlier request.',
        409,
      );
    return Response.json(
      serializeGrade(await getCurrentGrade(submissionId), maxGrade),
    );
  }
  // Append-only revisions: a stale tab cannot replace a newer grade.
  const saved = await db
    .prepare(`INSERT INTO submission_grades (id, submission_id, score, revision, graded_by, created_at)
    SELECT ?, ?, ?, ?, ?, ? WHERE COALESCE((SELECT MAX(revision) FROM submission_grades WHERE submission_id = ?), 0) = ?
    ON CONFLICT DO NOTHING RETURNING *`)
    .bind(
      body.request_id,
      submissionId,
      score,
      revision,
      professor.userId,
      new Date().toISOString(),
      submissionId,
      body.base_revision,
    )
    .first<GradeRow>();
  if (!saved)
    return errorResponse(
      'The grade changed in another tab. Reload the saved grade before submitting again; your entered score is still here.',
      409,
    );
  return Response.json(serializeGrade(saved, maxGrade));
}
