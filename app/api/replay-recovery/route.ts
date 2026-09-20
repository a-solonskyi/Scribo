import { getRawDb } from "@/db";
import { requireApprovedProfessor } from "@/lib/server/professor";
import { errorResponse, readJsonObject, stringValue } from "@/lib/server/data";
import { assessReplayRecovery, prepareReplayRecovery } from "@/src/utils/replayRecovery";

export const dynamic = "force-dynamic";
type Submission = {
  id: string; assignment_id: string; student_name: string; final_text: string;
  event_log_json: string; stats_json: string; paste_events_json: string;
  pause_events_json: string; submitted_at: string;
};
type Draft = { assignment_id: string; submitted_at: string; draft_json: string; revision: string };

function ownedSubmission(id: string, professorId: string) {
  return getRawDb().prepare(`SELECT s.* FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id WHERE s.id = ? AND a.professor_id = ?`)
    .bind(id, professorId).first<Submission>();
}

async function assess(row: Submission) {
  // Timestamp was written atomically to both rows on account submission.
  const drafts = await getRawDb().prepare(`SELECT assignment_id, submitted_at, draft_json, revision
    FROM student_drafts WHERE assignment_id = ? AND submitted_at = ?`)
    .bind(row.assignment_id, row.submitted_at).all<Draft>();
  return assessReplayRecovery(row, drafts.results);
}

export async function GET(request: Request) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse("Professor access required.", 401);
  const after = new URL(request.url).searchParams.get("after") || "";
  if (after.length > 200) return errorResponse("Invalid page.");
  const ids = await getRawDb().prepare(`SELECT s.id FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    WHERE a.professor_id = ? AND s.id > ? ORDER BY s.id LIMIT 6`)
    .bind(professor.userId, after).all<{ id: string }>();
  const items = [];
  for (const { id } of ids.results.slice(0, 5)) {
    const row = await ownedSubmission(id, professor.userId);
    if (!row) continue;
    try {
      const result = await assess(row);
      // Construct the exact repair in the read-only check, including backup
      // and size checks, so only actionable rows are offered for recovery.
      if (result.status === "recoverable") await prepareReplayRecovery(row, result.candidate);
      items.push({ id, studentName: row.student_name, status: result.status });
    } catch {
      items.push({ id, studentName: row.student_name, status: "error" });
    }
  }
  return Response.json({ items, nextCursor: ids.results.length > 5 ? ids.results[4].id : null },
    { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse("Professor access required.", 401);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return errorResponse("Invalid request origin.", 403);
  const body = await readJsonObject(request);
  const row = await ownedSubmission(stringValue(body.submissionId), professor.userId);
  if (!row) return errorResponse("Submission not found.", 404);
  const assessment = await assess(row);
  if (assessment.status === "complete") return Response.json({ status: "complete" });
  if (assessment.status !== "recoverable") return errorResponse("There is no unique, verified saved draft for this submission.", 409);
  try {
    const repaired = await prepareReplayRecovery(row, assessment.candidate);
    const result = await getRawDb().prepare(`UPDATE submissions
      SET event_log_json = ?, stats_json = ?, paste_events_json = ?, pause_events_json = ?
      WHERE id = ? AND event_log_json = ? AND stats_json = ? AND paste_events_json = ? AND pause_events_json = ?`)
      .bind(repaired.event_log_json, repaired.stats_json, repaired.paste_events_json, repaired.pause_events_json,
        row.id, row.event_log_json, row.stats_json, row.paste_events_json, row.pause_events_json).run();
    if (!result.meta.changes) return errorResponse("The submission changed during recovery. Check it again.", 409);
    return Response.json({ status: "recovered" });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Recovery failed. The original submission is unchanged.", 500);
  }
}
