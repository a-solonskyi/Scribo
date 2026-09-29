import { computeSubmissionStats, maybeCreatePause } from "./writingAnalytics.js";
import { getWritingTimeline, getWritingSplice } from "./writingHistory.js";
import { applyChangeToOriginRanges, countOriginRanges, isPasteOriginEvent } from "./characterOrigins.js";
import { sanitizeEventMetadata, sanitizeStatistics } from "./submissionMetadata.js";

// New submissions only: derive metrics from the validated history. Original
// event/paste/pause fields are stored separately and never rewritten here.
export function deriveWritingEvidence(eventLog, complete) {
  const events = complete ? getWritingTimeline(sanitizeEventMetadata(eventLog)) : [];
  // Count actual inserted characters once per operation. A separate clipboard
  // payload or claimed character count cannot substitute different content.
  const pastes = events.filter((event) => isPasteOriginEvent(event, []) && event.inserted_text.length)
    .map((event) => ({
      paste_event_id: event.paste_event_id,
      timestamp_ms: event.timestamp_ms, position: event.position,
      pasted_text: event.inserted_text, pastedText: event.inserted_text,
      character_count: event.inserted_text.length,
      inferred: event.event_type !== "paste",
      detection_method: event.detection_method || "event_log",
    }));
  const pauses = events.flatMap((event, index) => {
    const pause = maybeCreatePause(events[index - 1], event.timestamp_ms);
    return pause ? [pause] : [];
  });
  return { events, pastes, pauses };
}

export function deriveSubmissionStatistics({ finalText, eventLog, integrity, reportedStats }) {
  const complete = integrity.status === "complete";
  const { events, pastes, pauses } = deriveWritingEvidence(eventLog, complete);
  let origins = [];
  let length = 0;
  for (const event of events) {
    const splice = getWritingSplice(event, length);
    origins = applyChangeToOriginRanges(origins, event, length, isPasteOriginEvent(event, []));
    length += splice.insertedText.length - splice.deletedCount;
  }
  const reported = sanitizeStatistics(reportedStats);
  return {
    ...computeSubmissionStats({ finalText, eventLog: events, pasteEvents: pastes, pauseEvents: pauses }),
    finalHtml: reported.finalHtml,
    pasteOriginRanges: origins,
    finalPastedCharacters: countOriginRanges(origins, finalText.length),
    pasteDetectionVersion: 2,
    analyticsVersion: 1,
    analyticsSource: complete ? "validated_history" : "text_only_incomplete_history",
  };
}
