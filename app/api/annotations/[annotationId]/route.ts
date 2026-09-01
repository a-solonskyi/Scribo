import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { responseAnnotations } from "@/db/schema";
import { errorResponse, getOwnedAnnotation, readJsonObject, serializeAnnotation, stringValue } from "@/lib/server/data";
import { requireApprovedProfessor } from "@/lib/server/professor";

type Context = { params: Promise<{ annotationId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse("Professor access required.", 401);
  const { annotationId } = await params;
  const owned = await getOwnedAnnotation(professor.userId, annotationId);
  if (!owned) return errorResponse("Annotation not found.", 404);

  const body = await readJsonObject(request);
  const patch: Partial<typeof responseAnnotations.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };
  if ("comment_text" in body) patch.commentText = stringValue(body.comment_text).slice(0, 10000) || null;
  if ("color" in body) patch.color = stringValue(body.color).slice(0, 40) || "yellow";
  if ("drawing_path_json" in body) patch.drawingPathJson = body.drawing_path_json ? JSON.stringify(body.drawing_path_json) : null;

  const [updated] = await getDb().update(responseAnnotations).set(patch)
    .where(eq(responseAnnotations.id, annotationId)).returning();
  return Response.json(serializeAnnotation(updated));
}

export async function DELETE(_request: Request, { params }: Context) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse("Professor access required.", 401);
  const { annotationId } = await params;
  if (!(await getOwnedAnnotation(professor.userId, annotationId))) return errorResponse("Annotation not found.", 404);
  await getDb().delete(responseAnnotations).where(eq(responseAnnotations.id, annotationId));
  return Response.json({ ok: true });
}
