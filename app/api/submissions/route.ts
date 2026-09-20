import { eq } from "drizzle-orm";
import { getDb, getRawDb } from "@/db";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { findStudentDraft } from "@/lib/server/student-drafts";
import { assignments, submissions } from "@/db/schema";
import { errorResponse, stringValue } from "@/lib/server/data";
import { assertSubmissionFits, prepareSubmissionHistory, readSubmissionJson } from "@/src/utils/submissionHistory";
import { decodeDraft } from "@/src/utils/draftEncoding";

function jsonText(value: unknown, fallback: unknown) {
  return JSON.stringify(value ?? fallback);
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function submissionError(error: unknown, fallbackStatus: number) {
  const message = error instanceof Error ? error.message : "Your essay could not be saved. Your draft is still available.";
  const status = error instanceof Error && "status" in error && typeof error.status === "number" ? error.status : fallbackStatus;
  return errorResponse(message, status);
}

function firstForwardedAddress(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function detectOperatingSystem(userAgent: string | null) {
  if (!userAgent) return null;

  const ipad = userAgent.match(/(?:CPU OS|iPad; CPU OS) ([\d_]+)/i);
  if (ipad) return `iPadOS ${ipad[1].replaceAll("_", ".")}`;

  const iphone = userAgent.match(/iPhone OS ([\d_]+)/i);
  if (iphone) return `iOS ${iphone[1].replaceAll("_", ".")}`;

  const android = userAgent.match(/Android ([\d.]+)/i);
  if (android) return `Android ${android[1]}`;

  const windows = userAgent.match(/Windows NT ([\d.]+)/i);
  if (windows) {
    const names: Record<string, string> = {
      "10.0": "Windows 10 or 11",
      "6.3": "Windows 8.1",
      "6.2": "Windows 8",
      "6.1": "Windows 7",
    };
    return names[windows[1]] || `Windows NT ${windows[1]}`;
  }

  const mac = userAgent.match(/Mac OS X ([\d_]+)/i);
  if (mac) return `macOS ${mac[1].replaceAll("_", ".")}`;

  if (/CrOS/i.test(userAgent)) return "ChromeOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return null;
}

function getDeviceInfo(request: Request) {
  const headers = request.headers;
  const ip =
    firstForwardedAddress(headers.get("cf-connecting-ip")) ||
    firstForwardedAddress(headers.get("x-real-ip")) ||
    firstForwardedAddress(headers.get("x-forwarded-for"));
  const country = headers.get("cf-ipcountry")?.trim().toUpperCase() || null;

  return {
    ip,
    country,
    operatingSystem: detectOperatingSystem(headers.get("user-agent")),
  };
}

export async function POST(request: Request) {
  let body;
  try { body = await readSubmissionJson(request); }
  catch (error) { return submissionError(error, 400); }
  const stats = objectValue(body.stats_json);
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

  let history;
  let storedStats;
  const storedPastes = jsonText(body.paste_events_json, []);
  const storedPauses = jsonText(body.pause_events_json, []);
  try {
    history = await prepareSubmissionHistory(body.event_log_json ?? [], finalText);
    storedStats = jsonText({ ...stats, deviceInfo: getDeviceInfo(request), replayIntegrity: history.integrity }, {});
    assertSubmissionFits([finalText, studentName, stringValue(body.title), storedStats, history.encoded, storedPastes, storedPauses]);
  } catch (error) {
    return submissionError(error, 500);
  }

  if (Object.hasOwn(body, "student_draft_revision")) {
    const user = await getChatGPTUser();
    if (!user) return errorResponse("Sign in with ChatGPT again before submitting.", 401);
    if (body.expected_user_id !== user.userId) return errorResponse("Your signed-in account changed. Sign in with the original account before submitting.", 401);
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return errorResponse("Invalid request origin.", 403);
    const revision = stringValue(body.student_draft_revision);
    const draft = await findStudentDraft(assignmentId, user.userId);
    // A retry after a lost submission response must not submit the essay twice.
    if (draft?.submitted_at) return Response.json({ ok: true });
    if (!draft || draft.revision !== revision) return errorResponse("Your account draft changed. Download your edits and reload before submitting.", 409);
    const snapshot = await decodeDraft(draft.draft_json);
    if (snapshot.essayText !== finalText || JSON.stringify(snapshot.eventLog) !== JSON.stringify(body.event_log_json)) {
      return errorResponse("Your latest writing has not finished saving. Wait for saving to finish, then submit again.", 409);
    }
    const submittedAt = new Date().toISOString();
    const db = getRawDb();
    const result = await db.batch([
      db.prepare(`
        INSERT INTO submissions (id, assignment_id, student_name, final_text, title, stats_json, event_log_json, paste_events_json, pause_events_json, submitted_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM student_drafts
        WHERE assignment_id = ? AND user_id = ? AND revision = ? AND submitted_at IS NULL
      `).bind(crypto.randomUUID(), assignmentId, studentName, finalText,
        stringValue(body.title).slice(0, 240) || null,
        storedStats,
        history.encoded, storedPastes, storedPauses,
        submittedAt, assignmentId, user.userId, revision),
      db.prepare(`
        UPDATE student_drafts SET submitted_at = ?, updated_at = ?
        WHERE assignment_id = ? AND user_id = ? AND revision = ? AND submitted_at IS NULL
      `).bind(submittedAt, submittedAt, assignmentId, user.userId, revision),
    ]);
    if (!result[0].meta.changes) {
      const latest = await findStudentDraft(assignmentId, user.userId);
      if (!latest?.submitted_at) return errorResponse("Your draft changed in another tab. Download your edits and reload before submitting.", 409);
    }
    return Response.json({ ok: true }, { status: 201 });
  }

  await getDb().insert(submissions).values({
    id: crypto.randomUUID(),
    assignmentId,
    studentName,
    finalText,
    title: stringValue(body.title).slice(0, 240) || null,
    statsJson: storedStats,
    eventLogJson: history.encoded,
    pasteEventsJson: storedPastes,
    pauseEventsJson: storedPauses,
    submittedAt: new Date().toISOString(),
  });

  return Response.json({ ok: true }, { status: 201 });
}
