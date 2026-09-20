import { decodeDraft, encodeDraft } from "./draftEncoding.js";
import { decodeSubmissionHistory, prepareSubmissionHistory, assertSubmissionFits } from "./submissionHistory.js";
import { validateWritingHistory } from "./writingHistory.js";
import { computeSubmissionStats } from "./writingAnalytics.js";
import { reconstructOriginMap, originMapToRanges, countOriginRanges } from "./characterOrigins.js";

function parseObject(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

export async function assessReplayRecovery(submission, draftRows = []) {
  try {
    const events = await decodeSubmissionHistory(submission.event_log_json);
    if (validateWritingHistory(events, submission.final_text).status === "complete") return { status: "complete" };
  } catch { /* Original bytes are retained if a valid matching draft exists. */ }
  const matches = [];
  for (const row of draftRows) {
    if (row.assignment_id !== submission.assignment_id || !row.submitted_at || row.submitted_at !== submission.submitted_at) continue;
    try {
      const draft = await decodeDraft(row.draft_json);
      if (draft.studentName?.trim() !== submission.student_name || draft.essayText !== submission.final_text) continue;
      if (validateWritingHistory(draft.eventLog, submission.final_text).status !== "complete") continue;
      matches.push({ row, draft });
    } catch { /* An unreadable draft is not a recovery source. */ }
  }
  if (matches.length !== 1) return { status: matches.length ? "ambiguous" : "unavailable" };
  return { status: "recoverable", candidate: matches[0] };
}

export async function prepareReplayRecovery(submission, candidate, recoveredAt = new Date().toISOString()) {
  // Recheck the exact candidate, never infer missing edits from the final text.
  const assessment = await assessReplayRecovery(submission, [candidate.row]);
  if (assessment.status !== "recoverable") throw new Error("No verified saved draft is available.");
  const draft = assessment.candidate.draft;
  const pastes = Array.isArray(draft.pasteEvents) ? draft.pasteEvents : [];
  const pauses = Array.isArray(draft.pauseEvents) ? draft.pauseEvents : [];
  const history = await prepareSubmissionHistory(draft.eventLog, submission.final_text);
  const origins = originMapToRanges(reconstructOriginMap(draft.eventLog, pastes));
  const backup = await encodeDraft({
    event_log_json: submission.event_log_json,
    stats_json: submission.stats_json,
    paste_events_json: submission.paste_events_json,
    pause_events_json: submission.pause_events_json,
  });
  const stats = {
    ...parseObject(submission.stats_json),
    ...computeSubmissionStats({ finalText: submission.final_text, eventLog: draft.eventLog, pasteEvents: pastes, pauseEvents: pauses }),
    pasteOriginRanges: origins,
    finalPastedCharacters: countOriginRanges(origins, submission.final_text.length),
    pasteDetectionVersion: 2,
    replayIntegrity: history.integrity,
    replayRecovery: { version: 1, recoveredAt, draftRevision: candidate.row.revision, backup },
  };
  const result = {
    event_log_json: history.encoded,
    stats_json: JSON.stringify(stats),
    paste_events_json: JSON.stringify(pastes),
    pause_events_json: JSON.stringify(pauses),
  };
  assertSubmissionFits([submission.final_text, submission.student_name, ...Object.values(result)]);
  return result;
}
