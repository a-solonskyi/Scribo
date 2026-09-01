import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { responseAnnotations } from "@/db/schema";
import { errorResponse, getOwnedSubmission, readJsonObject, serializeAnnotation, stringValue } from "@/lib/server/data";
import { requireApprovedProfessor } from "@/lib/server/professor";

type Context = { params: Promise<{ submissionId: string }> };
const ALLOWED_TYPES = new Set(["highlight", "comment", "drawing"]);

export async function GET(_request: Request, { params }: Context) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse("Professor access required.", 401);
  const { submissionId } = await params;
  if (!(await getOwnedSubmission(professor.userId, submissionId))) return errorResponse("Submission not found.", 404);
  const rows = await getDb().select().from(responseAnnotations)
    .where(eq(responseAnnotations.submissionId, submissionId)).orderBy(asc(responseAnnotations.createdAt));
  return Response.json(rows.map(serializeAnnotation));
}

export async function POST(request: Request, { params }: Context) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse("Professor access required.", 401);
  const { submissionId } = await params;
  const owned = await getOwnedSubmission(professor.userId, submissionId);
  if (!owned) return errorResponse("Submission not found.", 404);

  const body = await readJsonObject(request);
  const type = stringValue(body.type);
  if (!ALLOWED_TYPES.has(type)) return errorResponse("Annotation type is invalid.");
  const startOffset =
    typeof body.start_offset === "number" && Number.isInteger(body.start_offset)
      ? body.start_offset
      : null;
  const endOffset =
    typeof body.end_offset === "number" && Number.isInteger(body.end_offset)
      ? body.end_offset
      : null;
  if (type !== "drawing" && (startOffset === null || endOffset === null || startOffset < 0 || endOffset <= startOffset || endOffset > owned.submission.finalText.length)) {
    return errorResponse("Text selection is invalid.");
  }

  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    submissionId,
    professorId: professor.userId,
    type,
    startOffset,
    endOffset,
    textQuote: stringValue(body.text_quote).slice(0, 5000) || null,
    commentText: stringValue(body.comment_text).slice(0, 10000) || null,
    color: stringValue(body.color).slice(0, 40) || "yellow",
    drawingPathJson: body.drawing_path_json ? JSON.stringify(body.drawing_path_json) : null,
    createdAt: now,
    updatedAt: now,
  };
  await getDb().insert(responseAnnotations).values(row);
  return Response.json(serializeAnnotation(row), { status: 201 });
}
