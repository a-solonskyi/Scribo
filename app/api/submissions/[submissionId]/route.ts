import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { submissions } from "@/db/schema";
import { errorResponse, getOwnedSubmission, serializeSubmission } from "@/lib/server/data";
import { requireApprovedProfessor } from "@/lib/server/professor";

type Context = { params: Promise<{ submissionId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse("Professor access required.", 401);
  const { submissionId } = await params;
  const row = await getOwnedSubmission(professor.userId, submissionId);
  if (!row) return errorResponse("Submission not found.", 404);
  return Response.json(serializeSubmission(row.submission, row.assignment));
}

export async function DELETE(_request: Request, { params }: Context) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse("Professor access required.", 401);
  const { submissionId } = await params;
  const owned = await getOwnedSubmission(professor.userId, submissionId);
  if (!owned) return errorResponse("Submission not found.", 404);
  await getDb().delete(submissions).where(eq(submissions.id, submissionId));
  return Response.json({ ok: true });
}
