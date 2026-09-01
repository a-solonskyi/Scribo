export const BULK_INSERT_PASTE_THRESHOLD = 80;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function sanitizeOriginRanges(ranges = [], textLength = 0) {
  const normalized = ranges
    .map((range) => ({
      start: clamp(Number(range.start) || 0, 0, textLength),
      end: clamp(Number(range.end) || 0, 0, textLength),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);

  return normalized.reduce((merged, range) => {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
      return merged;
    }

    merged.push({ ...range });
    return merged;
  }, []);
}

export function originRangesToMap(textLength, ranges = []) {
  const map = new Array(Math.max(0, textLength)).fill(false);

  for (const range of sanitizeOriginRanges(ranges, map.length)) {
    for (let index = range.start; index < range.end; index += 1) {
      map[index] = true;
    }
  }

  return map;
}

export function originMapToRanges(originMap = []) {
  const ranges = [];
  let cursor = 0;

  while (cursor < originMap.length) {
    if (!originMap[cursor]) {
      cursor += 1;
      continue;
    }

    const start = cursor;
    while (cursor < originMap.length && originMap[cursor]) cursor += 1;
    ranges.push({ start, end: cursor });
  }

  return ranges;
}

export function applyChangeToOriginMap(originMap, change, insertedIsPasted) {
  const nextMap = [...originMap];
  const position = clamp(change.position || 0, 0, nextMap.length);
  const deletedCount = clamp(
    change.deletedCharacterCount ?? change.deleted_character_count ?? 0,
    0,
    nextMap.length - position
  );
  const insertedLength = (
    change.insertedText ||
    change.inserted_text ||
    change.pasted_text ||
    ""
  ).length;
  const insertedOrigins = new Array(insertedLength).fill(Boolean(insertedIsPasted));

  nextMap.splice(position, deletedCount, ...insertedOrigins);
  return nextMap;
}

export function countOriginRanges(ranges = [], textLength = Infinity) {
  const safeLength = Number.isFinite(textLength)
    ? Math.max(0, textLength)
    : Number.MAX_SAFE_INTEGER;

  return sanitizeOriginRanges(ranges, safeLength).reduce(
    (sum, range) => sum + (range.end - range.start),
    0
  );
}

export function isBulkInsertEvent(event) {
  const insertedText = event.inserted_text || event.pasted_text || "";
  return (
    ["insert", "replace"].includes(event.event_type) &&
    insertedText.length >= BULK_INSERT_PASTE_THRESHOLD
  );
}

function normalizeText(text = "") {
  return text.replace(/\s+/gu, " ").trim().toLowerCase();
}

function pasteMatchesEvent(paste, event) {
  if (paste.paste_event_id && event.paste_event_id) {
    return paste.paste_event_id === event.paste_event_id;
  }

  const pastedText = paste.pasted_text || paste.pastedText || "";
  const insertedText = event.pasted_text || event.inserted_text || "";
  const timeClose =
    Math.abs((paste.timestamp_ms || 0) - (event.timestamp_ms || 0)) <= 1500;
  const lengthClose =
    Math.abs(pastedText.length - insertedText.length) <=
    Math.max(12, pastedText.length * 0.15);
  const pastedNormalized = normalizeText(pastedText);
  const insertedNormalized = normalizeText(insertedText);
  const textRelated =
    !pastedNormalized ||
    !insertedNormalized ||
    pastedNormalized.includes(insertedNormalized) ||
    insertedNormalized.includes(pastedNormalized);

  return timeClose && (lengthClose || textRelated);
}

export function isPasteOriginEvent(event, pasteEvents = []) {
  if (
    event.event_type === "paste" ||
    event.inserted_origin === "paste" ||
    isBulkInsertEvent(event)
  ) {
    return true;
  }

  return pasteEvents.some((paste) => pasteMatchesEvent(paste, event));
}

export function reconstructOriginMap(eventLog = [], pasteEvents = []) {
  let originMap = [];
  const sortedEvents = [...eventLog].sort(
    (a, b) => (a.timestamp_ms || 0) - (b.timestamp_ms || 0)
  );

  for (const event of sortedEvents) {
    originMap = applyChangeToOriginMap(
      originMap,
      event,
      isPasteOriginEvent(event, pasteEvents)
    );
  }

  return originMap;
}

export function getEffectivePasteEvents(eventLog = [], pasteEvents = []) {
  const effective = pasteEvents.map((paste) => ({ ...paste }));
  const sortedEvents = [...eventLog].sort(
    (a, b) => (a.timestamp_ms || 0) - (b.timestamp_ms || 0)
  );

  for (const event of sortedEvents) {
    if (!isPasteOriginEvent(event, pasteEvents)) continue;
    if (effective.some((paste) => pasteMatchesEvent(paste, event))) continue;

    const pastedText = event.pasted_text || event.inserted_text || "";
    if (!pastedText) continue;

    effective.push({
      paste_event_id: event.paste_event_id || null,
      timestamp_ms: event.timestamp_ms || 0,
      pastedText,
      pasted_text: pastedText,
      character_count: pastedText.length,
      position: event.position || 0,
      inferred: event.event_type !== "paste",
      detection_method:
        event.detection_method ||
        (isBulkInsertEvent(event) ? "bulk_insert_fallback" : "event_log"),
    });
  }

  return effective.sort(
    (a, b) => (a.timestamp_ms || 0) - (b.timestamp_ms || 0)
  );
}
