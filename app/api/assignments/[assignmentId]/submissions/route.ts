import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { submissions } from "@/db/schema";
import { errorResponse, getOwnedAssignment, serializeSubmission } from "@/lib/server/data";
import { requireApprovedProfessor } from "@/lib/server/professor";

type Context = { params: Promise<{ assignmentId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse("Professor access required.", 401);
  const { assignmentId } = await params;
  if (!(await getOwnedAssignment(professor.userId, assignmentId))) return errorResponse("Essay not found.", 404);
  const rows = await getDb().select().from(submissions)
    .where(eq(submissions.assignmentId, assignmentId)).orderBy(desc(submissions.submittedAt));
  return Response.json(rows.map((row) => serializeSubmission(row)));
}
