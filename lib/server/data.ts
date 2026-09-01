import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments, classes, responseAnnotations, submissions } from "@/db/schema";

export function parseJson(value: string | null, fallback: unknown) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const value: unknown = await request.json().catch(() => null);
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function serializeClass(row: typeof classes.$inferSelect) {
  return {
    id: row.id,
    professor_id: row.professorId,
    name: row.name,
    description: row.description,
    created_at: row.createdAt,
  };
}

export function serializeAssignment(row: typeof assignments.$inferSelect, className?: string | null) {
  return {
    id: row.id,
    class_id: row.classId,
    professor_id: row.professorId,
    topic: row.topic,
    instructions: row.instructions,
    public_token: row.publicToken,
    deadline: row.deadline,
    created_at: row.createdAt,
    ...(className === undefined ? {} : { classes: { name: className } }),
  };
}

export function serializeSubmission(
  row: typeof submissions.$inferSelect,
  assignment?: typeof assignments.$inferSelect,
) {
  return {
    id: row.id,
    assignment_id: row.assignmentId,
    student_name: row.studentName,
    final_text: row.finalText,
    title: row.title,
    stats_json: parseJson(row.statsJson, {}),
    event_log_json: parseJson(row.eventLogJson, []),
    paste_events_json: parseJson(row.pasteEventsJson, []),
    pause_events_json: parseJson(row.pauseEventsJson, []),
    submitted_at: row.submittedAt,
    ...(assignment
      ? {
          assignments: {
            topic: assignment.topic,
            instructions: assignment.instructions,
            professor_id: assignment.professorId,
            class_id: assignment.classId,
          },
        }
      : {}),
  };
}

export function serializeAnnotation(row: typeof responseAnnotations.$inferSelect) {
  return {
    id: row.id,
    submission_id: row.submissionId,
    professor_id: row.professorId,
    type: row.type,
    start_offset: row.startOffset,
    end_offset: row.endOffset,
    text_quote: row.textQuote,
    comment_text: row.commentText,
    color: row.color,
    drawing_path_json: parseJson(row.drawingPathJson, null),
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function getOwnedClass(professorId: string, classId: string) {
  const [row] = await getDb().select().from(classes)
    .where(and(eq(classes.id, classId), eq(classes.professorId, professorId))).limit(1);
  return row ?? null;
}

export async function getOwnedAssignment(professorId: string, assignmentId: string) {
  const [row] = await getDb().select().from(assignments)
    .where(and(eq(assignments.id, assignmentId), eq(assignments.professorId, professorId))).limit(1);
  return row ?? null;
}

export async function getOwnedSubmission(professorId: string, submissionId: string) {
  const [row] = await getDb()
    .select({ submission: submissions, assignment: assignments })
    .from(submissions)
    .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
    .where(and(eq(submissions.id, submissionId), eq(assignments.professorId, professorId)))
    .limit(1);
  return row ?? null;
}

export async function getOwnedAnnotation(professorId: string, annotationId: string) {
  const [row] = await getDb()
    .select({ annotation: responseAnnotations, assignment: assignments })
    .from(responseAnnotations)
    .innerJoin(submissions, eq(responseAnnotations.submissionId, submissions.id))
    .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
    .where(and(eq(responseAnnotations.id, annotationId), eq(assignments.professorId, professorId)))
    .limit(1);
  return row ?? null;
}

export function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
