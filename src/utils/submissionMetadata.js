// Read projections only. Callers keep raw evidence in storage and exports.
export const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
export const safeNumber = (value, fallback = 0) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : fallback;
const text = (value) => typeof value === "string" ? value : "";

export function sanitizePasteEvents(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event) => {
    const pasted = text(event.pasted_text) || text(event.pastedText) || text(event.text);
    return {
      paste_event_id: text(event.paste_event_id) || null,
      timestamp_ms: safeNumber(event.timestamp_ms), position: safeNumber(event.position),
      pasted_text: pasted, pastedText: pasted,
      character_count: safeNumber(event.character_count, pasted.length),
      detection_method: text(event.detection_method), inferred: event.inferred === true,
    };
  });
}

export function sanitizePauseEvents(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((event) => isRecord(event) && safeNumber(event.start_ms, null) !== null && safeNumber(event.end_ms, null) !== null && event.end_ms >= event.start_ms)
    .map((event) => ({ start_ms: event.start_ms, end_ms: event.end_ms, duration_ms: safeNumber(event.duration_ms, event.end_ms - event.start_ms) }));
}

// Structural integrity is checked separately before a projection is replayed.
// Optional metadata must not turn an otherwise valid splice into a UI crash.
export function sanitizeEventMetadata(events) {
  if (!Array.isArray(events)) return [];
  return events.filter(isRecord).map((event) => ({
    ...event,
    inserted_text: text(event.inserted_text ?? event.insertedText ?? event.pasted_text),
    deleted_character_count: safeNumber(event.deleted_character_count ?? event.deletedCharacterCount),
    pasted_text: text(event.pasted_text),
    paste_event_id: text(event.paste_event_id) || null,
    detection_method: text(event.detection_method),
    inserted_origin: text(event.inserted_origin),
    timestamp_ms: safeNumber(event.timestamp_ms),
  }));
}

export const STAT_FIELDS = ["wordCount", "characterCount", "characterCountNoSpaces", "paragraphCount", "sentenceCount", "writingDurationMs", "activeWritingTimeMs", "idleTimeMs", "pauseCount", "longestPauseMs", "averagePauseMs", "deletedCharacters", "revisionRatio", "pasteEventCount", "totalPastedCharacters", "largestPasteEvent", "estimatedWritingSpeed", "wordsPerTotalMinute", "wordsPerActiveMinute", "finalPastedCharacters", "pasteDetectionVersion", "firstEventAtMs", "lastEventAtMs"];

export function sanitizeStatistics(value) {
  const source = isRecord(value) ? value : {};
  const result = Object.fromEntries(STAT_FIELDS.map((field) => [field, safeNumber(source[field], field.endsWith("AtMs") ? null : 0)]));
  result.finalHtml = text(source.finalHtml);
  result.pasteOriginRanges = Array.isArray(source.pasteOriginRanges) ? source.pasteOriginRanges.filter((range) => isRecord(range) && Number.isSafeInteger(range.start) && Number.isSafeInteger(range.end) && range.start >= 0 && range.end > range.start).map(({ start, end }) => ({ start, end })) : [];
  const device = isRecord(source.deviceInfo) ? source.deviceInfo : isRecord(source.device_info) ? source.device_info : {};
  result.deviceInfo = { ip: text(device.ip) || null, country: text(device.country) || null, operatingSystem: text(device.operatingSystem) || null };
  if (source.analyticsVersion === 1) {
    result.analyticsVersion = 1;
    result.analyticsSource = text(source.analyticsSource);
  }
  if (isRecord(source.replayRecovery)) {
    result.replayRecovery = {
      version: safeNumber(source.replayRecovery.version),
      recoveredAt: text(source.replayRecovery.recoveredAt),
      draftRevision: text(source.replayRecovery.draftRevision),
    };
  }
  return result;
}
