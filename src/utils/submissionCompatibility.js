import { validateWritingHistory } from "./writingHistory.js";

export const SUBMISSION_CLIENT_VERSION = 2;

// This is the exact historical transformation, including slice(-0). Use it
// only to recognize an older request, never to save a newly trimmed history.
function legacyTrim(events) {
  const important = events.filter((event) => ["paste", "delete", "replace"].includes(event.event_type));
  const inserts = events.filter((event) => event.event_type === "insert").slice(-Math.max(0, 4000 - important.length));
  return [...important, ...inserts].sort((a, b) => a.timestamp_ms - b.timestamp_ms);
}

export function matchesLegacySubmission(snapshot, body) {
  if (body.client_version !== undefined || !Array.isArray(snapshot?.eventLog) || snapshot.eventLog.length <= 4000 ||
      !Array.isArray(body.event_log_json) || snapshot.studentName?.trim() !== body.student_name?.trim() ||
      snapshot.essayText !== body.final_text) return false;
  if (validateWritingHistory(snapshot.eventLog, snapshot.essayText).status !== "complete") return false;
  return JSON.stringify(legacyTrim(snapshot.eventLog)) === JSON.stringify(body.event_log_json);
}
