import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments, classes } from "@/db/schema";
import { errorResponse, serializeAssignment } from "@/lib/server/data";
import { requireApprovedProfessor } from "@/lib/server/professor";

type Context = { params: Promise<{ assignmentId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse("Professor access required.", 401);
  const { assignmentId } = await params;
  const [row] = await getDb()
    .select({ assignment: assignments, className: classes.name })
    .from(assignments)
    .innerJoin(classes, eq(assignments.classId, classes.id))
    .where(and(eq(assignments.id, assignmentId), eq(assignments.professorId, professor.userId)))
    .limit(1);
  if (!row) return errorResponse("Essay not found.", 404);
  return Response.json(serializeAssignment(row.assignment, row.className));
}

export async function DELETE(_request: Request, { params }: Context) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse("Professor access required.", 401);
  const { assignmentId } = await params;
  const result = await getDb().delete(assignments)
    .where(and(eq(assignments.id, assignmentId), eq(assignments.professorId, professor.userId)))
    .returning({ id: assignments.id });
  if (!result.length) return errorResponse("Essay not found.", 404);
  return Response.json({ ok: true });
}
