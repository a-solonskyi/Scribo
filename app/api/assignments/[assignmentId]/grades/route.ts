import { getRawDb } from '@/db';
import { errorResponse, getOwnedAssignment } from '@/lib/server/data';
import { requireApprovedProfessor } from '@/lib/server/professor';
import { getMaxGrade, latestGradeJoin } from '@/lib/server/grading';
import {
  completeOnTime,
  finalPastedPercent,
  splitStudentName,
} from '@/src/utils/grading';
type Context = { params: Promise<{ assignmentId: string }> };
type Row = {
  id: string;
  student_name: string;
  final_text: string;
  event_log_json: string;
  submitted_at: string;
  score: number | null;
  revision: number | null;
  email: string | null;
};
export async function GET(_request: Request, { params }: Context) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse('Professor access required.', 401);
  const { assignmentId } = await params,
    assignment = await getOwnedAssignment(professor.userId, assignmentId);
  if (!assignment) return errorResponse('Essay not found.', 404);
  const maxGrade = await getMaxGrade(assignmentId);
  const { results } = await getRawDb()
    .prepare(`SELECT s.id, s.student_name, s.final_text, s.event_log_json, s.submitted_at, g.score, g.revision, m.email
    FROM submissions s ${latestGradeJoin} LEFT JOIN submission_moodle_emails m ON m.submission_id = s.id
    WHERE s.assignment_id = ? ORDER BY s.submitted_at, s.id`)
    .bind(assignmentId)
    .all<Row>();
  const rows = [];
  // Derive one history at a time to bound working memory. Never update evidence.
  for (const row of results)
    rows.push({
      id: row.id,
      full_name: row.student_name,
      ...splitStudentName(row.student_name),
      score: row.score,
      revision: row.revision ?? 0,
      email: row.email ?? '',
      pasted_percent: await finalPastedPercent(
        row.final_text,
        row.event_log_json,
      ),
      on_time: completeOnTime(row.submitted_at, assignment.deadline),
      submitted_at: row.submitted_at,
    });
  return Response.json({
    max_grade: maxGrade,
    effective_max_grade: maxGrade ?? 100,
    rows,
  });
}
