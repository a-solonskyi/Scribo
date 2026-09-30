import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { responseAnnotations } from '@/db/schema';
import {
  errorResponse,
  getOwnedSubmission,
  readJsonObject,
  serializeAnnotation,
} from '@/lib/server/data';
import { requireApprovedProfessor } from '@/lib/server/professor';

import { validateResponseAnnotation } from '@/src/utils/responseAnnotations';

type Context = { params: Promise<{ submissionId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse('Professor access required.', 401);
  const { submissionId } = await params;
  if (!(await getOwnedSubmission(professor.userId, submissionId)))
    return errorResponse('Submission not found.', 404);
  const rows = await getDb()
    .select()
    .from(responseAnnotations)
    .where(eq(responseAnnotations.submissionId, submissionId))
    .orderBy(asc(responseAnnotations.createdAt));
  return Response.json(rows.map(serializeAnnotation));
}

export async function POST(request: Request, { params }: Context) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse('Professor access required.', 401);
  const { submissionId } = await params;
  const owned = await getOwnedSubmission(professor.userId, submissionId);
  if (!owned) return errorResponse('Submission not found.', 404);

  const body = await readJsonObject(request);
  const validated = validateResponseAnnotation(
    body,
    owned.submission.finalText,
  );
  if (!validated.value)
    return errorResponse(validated.error || 'Annotation is invalid.');
  const value = validated.value;

  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    submissionId,
    professorId: professor.userId,
    type: value.type,
    startOffset: value.startOffset,
    endOffset: value.endOffset,
    textQuote: value.textQuote,
    commentText: value.commentText,
    color: value.color,
    // Retain the historical spatial-data column without migrating old records.
    drawingPathJson: value.position ? JSON.stringify(value.position) : null,
    createdAt: now,
    updatedAt: now,
  };
  await getDb().insert(responseAnnotations).values(row);
  return Response.json(serializeAnnotation(row), { status: 201 });
}
