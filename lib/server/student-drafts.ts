import { getRawDb } from "@/db";
import { decodeDraft } from "@/src/utils/draftEncoding";

export type StudentDraftRow = {
  draft_json: string;
  revision: string;
  submitted_at: string | null;
  updated_at: string;
};

export function findStudentDraft(assignmentId: string, userId: string) {
  return getRawDb().prepare(
    "SELECT draft_json, revision, submitted_at, updated_at FROM student_drafts WHERE assignment_id = ? AND user_id = ?",
  ).bind(assignmentId, userId).first<StudentDraftRow>();
}

export async function serializeStudentDraft(row: StudentDraftRow | null) {
  return {
    draft: row ? await decodeDraft(row.draft_json) : null,
    revision: row?.revision ?? null,
    submitted: Boolean(row?.submitted_at),
    updatedAt: row?.updated_at ?? null,
  };
}
