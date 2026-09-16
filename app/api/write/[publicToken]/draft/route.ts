import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getRawDb } from "@/db";
import { findStudentDraft, serializeStudentDraft } from "@/lib/server/student-drafts";
import { encodeDraft } from "@/src/utils/draftEncoding";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ publicToken: string }> };
const response = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
});

async function findAssignment(context: Context) {
  const { publicToken } = await context.params;
  return getRawDb().prepare("SELECT id FROM assignments WHERE public_token = ?")
    .bind(publicToken).first<{ id: string }>();
}

export async function GET(_request: Request, context: Context) {
  const assignment = await findAssignment(context);
  if (!assignment) return response({ error: "Essay link not found." }, 404);
  const user = await getChatGPTUser();
  const row = user ? await findStudentDraft(assignment.id, user.userId) : null;
  return response({
    user: user ? { id: user.userId, displayName: user.displayName } : null,
    ...await serializeStudentDraft(row),
  });
}

export async function PUT(request: Request, context: Context) {
  const user = await getChatGPTUser();
  if (!user) return response({ error: "Sign in with ChatGPT again to save your progress." }, 401);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return response({ error: "Invalid request origin." }, 403);
  const assignment = await findAssignment(context);
  if (!assignment) return response({ error: "Essay link is no longer available." }, 404);

  // Stream-limit the full snapshot, including writing history, before parsing it.
  const reader = request.body?.getReader();
  if (!reader) return response({ error: "A draft is required." }, 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 16_000_000) {
      await reader.cancel();
      return response({ error: "This draft is too large to save online. Download a copy before leaving." }, 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { return response({ error: "Invalid draft." }, 400); }
  if (body?.expectedUserId !== user.userId) return response({ error: "Your signed-in account changed. Sign in with the original account to save this draft." }, 401);
  const draft = body?.draft;
  const revision = body?.revision;
  const baseRevision = body?.baseRevision;
  if (!draft || typeof draft !== "object" ||
      typeof draft.studentName !== "string" || draft.studentName.length > 180 ||
      typeof draft.essayText !== "string" || draft.essayText.length > 150000 ||
      typeof draft.essayHtml !== "string" || draft.essayHtml.length > 500000 ||
      ![draft.eventLog, draft.pasteEvents, draft.pasteOriginRanges, draft.pauseEvents].every(Array.isArray) ||
      !Number.isFinite(draft.startedAt) ||
      typeof revision !== "string" || !/^[\w-]{16,80}$/.test(revision) ||
      !(baseRevision === null || (typeof baseRevision === "string" && /^[\w-]{16,80}$/.test(baseRevision)))) {
    return response({ error: "Invalid draft or draft too large. Download a copy before leaving." }, 400);
  }
  const existing = await findStudentDraft(assignment.id, user.userId);
  if (existing?.submitted_at) return response({ error: "This essay has already been submitted. Download any additional edits before reloading." }, 409);
  if (existing?.revision === revision) return response({ revision });
  const encodedDraft = await encodeDraft(draft);
  if (encodedDraft.length > 1_500_000) return response({ error: "This draft’s writing history is too large to save online. Download a copy before leaving." }, 413);

  const result = await getRawDb().prepare(`
    INSERT INTO student_drafts (id, assignment_id, user_id, draft_json, revision, updated_at)
    SELECT ?, ?, ?, ?, ?, ? WHERE ? IS NULL
    ON CONFLICT(assignment_id, user_id) DO NOTHING
    RETURNING revision
  `).bind(crypto.randomUUID(), assignment.id, user.userId, encodedDraft, revision, new Date().toISOString(), baseRevision)
    .first<{ revision: string }>();
  if (result) return response(result);
  if (baseRevision !== null) {
    const updated = await getRawDb().prepare(`
      UPDATE student_drafts SET draft_json = ?, revision = ?, updated_at = ?
      WHERE assignment_id = ? AND user_id = ? AND revision = ? AND submitted_at IS NULL
      RETURNING revision
    `).bind(encodedDraft, revision, new Date().toISOString(), assignment.id, user.userId, baseRevision)
      .first<{ revision: string }>();
    if (updated) return response(updated);
  }
  return response({ error: "A newer draft is saved in another tab or device. Download your edits, then reload to choose a draft." }, 409);
}
