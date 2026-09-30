import { getRawDb } from '@/db';

export type GradeRow = {
  id: string;
  submission_id: string;
  score: number;
  revision: number;
  graded_by: string;
  created_at: string;
};
export async function getMaxGrade(assignmentId: string) {
  const row = await getRawDb()
    .prepare(
      'SELECT max_grade FROM assignment_grade_settings WHERE assignment_id = ?',
    )
    .bind(assignmentId)
    .first<{ max_grade: number }>();
  return row?.max_grade ?? null;
}
export async function getCurrentGrade(submissionId: string) {
  return getRawDb()
    .prepare(
      'SELECT id, submission_id, score, revision, graded_by, created_at FROM submission_grades WHERE submission_id = ? ORDER BY revision DESC LIMIT 1',
    )
    .bind(submissionId)
    .first<GradeRow>();
}
export function serializeGrade(row: GradeRow | null, maxGrade: number | null) {
  return {
    score: row?.score ?? null,
    revision: row?.revision ?? 0,
    graded_at: row?.created_at ?? null,
    max_grade: maxGrade,
    effective_max_grade: maxGrade ?? 100,
  };
}
export const latestGradeJoin = `LEFT JOIN submission_grades g ON g.submission_id = s.id AND g.revision = (SELECT MAX(revision) FROM submission_grades WHERE submission_id = s.id)`;
