import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments, responseAnnotations, submissions } from "@/db/schema";
import { errorResponse, readJsonObject } from "@/lib/server/data";
import { requireApprovedProfessor } from "@/lib/server/professor";

export async function POST(request: Request) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse("Professor access required.", 401);
  const body = await readJsonObject(request);
  const ids = Array.isArray(body.annotationIds)
    ? body.annotationIds.filter((id: unknown) => typeof id === "string").slice(0, 500)
    : [];
  if (!ids.length) return Response.json({ ok: true });

  const owned = await getDb()
    .select({ id: responseAnnotations.id })
    .from(responseAnnotations)
    .innerJoin(submissions, eq(responseAnnotations.submissionId, submissions.id))
    .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
    .where(and(inArray(responseAnnotations.id, ids), eq(assignments.professorId, professor.userId)));
  const ownedIds = owned.map((row) => row.id);
  if (ownedIds.length) {
    await getDb().delete(responseAnnotations).where(inArray(responseAnnotations.id, ownedIds));
  }
  return Response.json({ ok: true });
}
