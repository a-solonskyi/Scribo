import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments, submissions } from "@/db/schema";
import { errorResponse, readJsonObject, stringValue } from "@/lib/server/data";

function jsonText(value: unknown, fallback: unknown) {
  return JSON.stringify(value ?? fallback);
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  const assignmentId = stringValue(body.assignment_id);
  const studentName = stringValue(body.student_name).trim();
  const finalText = stringValue(body.final_text);
  if (!assignmentId || !studentName || !finalText.trim()) {
    return errorResponse("Student name and essay text are required.");
  }
  if (studentName.length > 180 || finalText.length > 150000) {
    return errorResponse("Submission is too large.", 413);
  }

  const [assignment] = await getDb().select({ id: assignments.id })
    .from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
  if (!assignment) return errorResponse("Essay link is no longer available.", 404);

  await getDb().insert(submissions).values({
    id: crypto.randomUUID(),
    assignmentId,
    studentName,
    finalText,
    title: stringValue(body.title).slice(0, 240) || null,
    statsJson: jsonText(body.stats_json, {}),
    eventLogJson: jsonText(body.event_log_json, []),
    pasteEventsJson: jsonText(body.paste_events_json, []),
    pauseEventsJson: jsonText(body.pause_events_json, []),
    submittedAt: new Date().toISOString(),
  });

  return Response.json({ ok: true }, { status: 201 });
}
