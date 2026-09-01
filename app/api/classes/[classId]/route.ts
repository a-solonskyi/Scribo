import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { classes } from "@/db/schema";
import { errorResponse, getOwnedClass, serializeClass } from "@/lib/server/data";
import { requireApprovedProfessor } from "@/lib/server/professor";

type Context = { params: Promise<{ classId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse("Professor access required.", 401);
  const { classId } = await params;
  const row = await getOwnedClass(professor.userId, classId);
  if (!row) return errorResponse("Class not found.", 404);
  return Response.json(serializeClass(row));
}

export async function DELETE(_request: Request, { params }: Context) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse("Professor access required.", 401);
  const { classId } = await params;
  const result = await getDb().delete(classes)
    .where(and(eq(classes.id, classId), eq(classes.professorId, professor.userId))).returning({ id: classes.id });
  if (!result.length) return errorResponse("Class not found.", 404);
  return Response.json({ ok: true });
}
