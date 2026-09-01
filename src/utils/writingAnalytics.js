import { getTextStats } from "./textStats.js";
import { BULK_INSERT_PASTE_THRESHOLD } from "./characterOrigins.js";

export const PAUSE_THRESHOLD_MS = 5000;

export function getTextChange(previousText, nextText) {
  let start = 0;
  const previousLength = previousText.length;
  const nextLength = nextText.length;

  while (
    start < previousLength &&
    start < nextLength &&
    previousText[start] === nextText[start]
  ) {
    start += 1;
  }

  let previousEnd = previousLength - 1;
  let nextEnd = nextLength - 1;

  while (
    previousEnd >= start &&
    nextEnd >= start &&
    previousText[previousEnd] === nextText[nextEnd]
  ) {
    previousEnd -= 1;
    nextEnd -= 1;
  }

  const deletedText = previousText.slice(start, previousEnd + 1);
  const insertedText = nextText.slice(start, nextEnd + 1);

  let type = "replace";
  if (insertedText && !deletedText) type = "insert";
  if (!insertedText && deletedText) type = "delete";

  return {
    type,
    position: start,
    insertedText,
    deletedText,
    deletedCharacterCount: deletedText.length,
  };
}

export function createWritingEvent({
  previousText,
  nextText,
  timestampMs,
  cursorPosition,
  pendingPaste,
  forcePaste = false,
}) {
  const change = getTextChange(previousText, nextText);
  if (!change.insertedText && !change.deletedText) return null;

  const pendingPastedText = pendingPaste?.pastedText || pendingPaste?.pasted_text || "";
  const pendingPasteIsRecent =
    pendingPaste &&
    Math.abs(timestampMs - (pendingPaste.timestamp_ms || timestampMs)) <= 2000;
  const matchesPendingPaste =
    pendingPasteIsRecent &&
    change.insertedText &&
    (change.insertedText === pendingPastedText ||
      change.insertedText.includes(pendingPastedText) ||
      pendingPastedText.includes(change.insertedText));
  const isBulkInsert =
    change.insertedText.length >= BULK_INSERT_PASTE_THRESHOLD;
  const isPaste =
    Boolean(change.insertedText) &&
    (forcePaste || matchesPendingPaste || isBulkInsert);

  return {
    timestamp_ms: timestampMs,
    event_type: isPaste ? "paste" : change.type,
    position: change.position,
    cursor_position: cursorPosition ?? change.position + change.insertedText.length,
    current_text_length: nextText.length,
    inserted_text: change.insertedText || null,
    deleted_character_count: change.deletedCharacterCount || 0,
    pasted_text: isPaste ? pendingPastedText || change.insertedText : null,
    inserted_origin: isPaste ? "paste" : "typed",
    paste_event_id: isPaste ? pendingPaste?.paste_event_id || null : null,
    detection_method: forcePaste
      ? "editor_paste_transaction"
      : matchesPendingPaste
        ? pendingPaste?.detection_method || "clipboard_event"
        : isBulkInsert
          ? "bulk_insert_fallback"
          : null,
  };
}

export function maybeCreatePause(previousEvent, timestampMs) {
  if (!previousEvent) return null;

  const durationMs = timestampMs - previousEvent.timestamp_ms;
  if (durationMs < PAUSE_THRESHOLD_MS) return null;

  return {
    start_ms: previousEvent.timestamp_ms,
    end_ms: timestampMs,
    duration_ms: durationMs,
  };
}

export function computeSubmissionStats({
  finalText,
  eventLog = [],
  pasteEvents = [],
  pauseEvents = [],
}) {
  const textStats = getTextStats(finalText);
  const sortedEvents = [...eventLog].sort((a, b) => a.timestamp_ms - b.timestamp_ms);
  const firstEvent = sortedEvents[0];
  const lastEvent = sortedEvents[sortedEvents.length - 1];
  const writingDurationMs = lastEvent ? lastEvent.timestamp_ms : 0;
  const totalPauseMs = pauseEvents.reduce(
    (sum, pause) => sum + (pause.duration_ms || 0),
    0
  );
  const activeWritingTimeMs = Math.max(0, writingDurationMs - totalPauseMs);
  const deletedCharacters = sortedEvents.reduce(
    (sum, event) => sum + (event.deleted_character_count || 0),
    0
  );
  const pasteEventCount = pasteEvents.length;
  const totalPastedCharacters = pasteEvents.reduce(
    (sum, event) => sum + (event.character_count || 0),
    0
  );
  const largestPasteEvent = pasteEvents.reduce(
    (max, event) => Math.max(max, event.character_count || 0),
    0
  );
  const longestPauseMs = pauseEvents.reduce(
    (max, pause) => Math.max(max, pause.duration_ms || 0),
    0
  );
  const averagePauseMs =
    pauseEvents.length > 0 ? totalPauseMs / pauseEvents.length : 0;
  const wordsPerTotalMinute =
    writingDurationMs > 0 ? textStats.wordCount / (writingDurationMs / 60000) : 0;
  const wordsPerActiveMinute =
    activeWritingTimeMs > 0
      ? textStats.wordCount / (activeWritingTimeMs / 60000)
      : 0;

  return {
    ...textStats,
    sentenceCount: getSentenceCount(finalText),
    writingDurationMs,
    activeWritingTimeMs,
    idleTimeMs: totalPauseMs,
    pauseCount: pauseEvents.length,
    longestPauseMs,
    averagePauseMs,
    deletedCharacters,
    revisionRatio:
      textStats.characterCount > 0
        ? deletedCharacters / textStats.characterCount
        : 0,
    pasteEventCount,
    totalPastedCharacters,
    largestPasteEvent,
    estimatedWritingSpeed: wordsPerActiveMinute,
    wordsPerTotalMinute,
    wordsPerActiveMinute,
    firstEventAtMs: firstEvent?.timestamp_ms ?? null,
    lastEventAtMs: lastEvent?.timestamp_ms ?? null,
  };
}

export function getSentenceCount(text) {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/gu) || [];
  return sentences.map((sentence) => sentence.trim()).filter(Boolean).length;
}

export function getActivityBuckets(eventLog = [], bucketMs = 10000) {
  if (!eventLog.length) return [];

  const buckets = new Map();

  for (const event of eventLog) {
    const index = Math.floor(event.timestamp_ms / bucketMs);
    const current = buckets.get(index) || {
      index,
      startMs: index * bucketMs,
      endMs: (index + 1) * bucketMs,
      inserts: 0,
      deletes: 0,
      pastes: 0,
      replacements: 0,
      insertedCharacters: 0,
      deletedCharacters: 0,
      pastedCharacters: 0,
      replacedCharacters: 0,
    };

    const insertedLength = (event.inserted_text || "").length;
    const deletedLength = event.deleted_character_count || 0;

    if (event.event_type === "insert") {
      current.inserts += 1;
      current.insertedCharacters += insertedLength;
    }
    if (event.event_type === "delete") {
      current.deletes += 1;
      current.deletedCharacters += deletedLength;
    }
    if (event.event_type === "paste") {
      current.pastes += 1;
      current.pastedCharacters +=
        (event.pasted_text || event.inserted_text || "").length;
    }
    if (event.event_type === "replace") {
      current.replacements += 1;
      current.replacedCharacters += insertedLength + deletedLength;
      current.insertedCharacters += insertedLength;
      current.deletedCharacters += deletedLength;
    }
    buckets.set(index, current);
  }

  return [...buckets.values()].sort((a, b) => a.index - b.index);
}
