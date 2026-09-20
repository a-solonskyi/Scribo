// Text and character origins must apply exactly the same UTF-16 splice.
export function getWritingSplice(event, textLength) {
  if (!event || typeof event !== "object") throw new Error("invalid_event");
  const position = event.position;
  const deletedCount = event.deleted_character_count ?? event.deletedCharacterCount ?? 0;
  const insertedText = event.inserted_text ?? event.insertedText ?? event.pasted_text ?? "";
  if (!Number.isSafeInteger(position) || position < 0 || position > textLength) throw new Error("invalid_position");
  if (!Number.isSafeInteger(deletedCount) || deletedCount < 0 || deletedCount > textLength - position) throw new Error("invalid_deletion");
  if (typeof insertedText !== "string") throw new Error("invalid_insertion");
  return { position, deletedCount, insertedText };
}

export function applyWritingEvent(text, event) {
  const { position, deletedCount, insertedText } = getWritingSplice(event, text.length);
  return text.slice(0, position) + insertedText + text.slice(position + deletedCount);
}

// Legacy recordings were appended in causal order. Sorting them by wall time
// can reorder dependent edits. New recordings carry an explicit sequence.
export function orderWritingEvents(eventLog = []) {
  if (!Array.isArray(eventLog)) return [];
  const events = [...eventLog];
  if (events.length && events.every((event) => Number.isSafeInteger(event?.sequence))) events.sort((a, b) => a.sequence - b.sequence);
  return events;
}

export function getWritingTimeline(eventLog = []) {
  let time = 0;
  return orderWritingEvents(eventLog).map((event) => {
    time = Math.max(time, Number.isFinite(event?.timestamp_ms) ? event.timestamp_ms : 0);
    return { ...event, timestamp_ms: time };
  });
}

export function validateWritingHistory(eventLog, finalText) {
  const incomplete = (reason, eventIndex = null) => ({
    version: 1, status: "incomplete", reason, eventIndex,
    eventCount: Array.isArray(eventLog) ? eventLog.length : 0,
  });
  if (!Array.isArray(eventLog)) return incomplete("invalid_history");
  const events = orderWritingEvents(eventLog);
  const sequenced = events.some((event) => event?.sequence !== undefined);
  let text = "";
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!event || !["insert", "delete", "replace", "paste"].includes(event.event_type)) return incomplete("invalid_event", index);
    if (!Number.isFinite(event.timestamp_ms)) return incomplete("invalid_timestamp", index);
    if (sequenced && event.sequence !== index) return incomplete("invalid_sequence", index);
    try { text = applyWritingEvent(text, event); }
    catch (error) { return incomplete(error.message, index); }
    if (event.current_text_length !== undefined && event.current_text_length !== text.length) return incomplete("length_mismatch", index);
    if (text.length > 1_000_000) return incomplete("replay_too_large", index);
  }
  if (text !== finalText) return incomplete("final_text_mismatch");
  return { version: 1, status: "complete", reason: null, eventIndex: null, eventCount: events.length };
}

export function initializeWritingEvents(events = []) {
  const ordered = orderWritingEvents(events);
  // Never conceal a gap in an existing sequenced recording by renumbering it.
  if (ordered.some((event) => event?.sequence !== undefined)) return ordered;
  return ordered.map((event, sequence) => ({ ...event, sequence }));
}

export function createWritingClock({ eventLog = [], startedAt, wallNow = Date.now, monotonicNow = () => performance.now() }) {
  const previousElapsed = eventLog.reduce((max, event) => Math.max(max, event.timestamp_ms || 0), 0);
  const offset = Math.max(previousElapsed, Math.max(0, wallNow() - startedAt));
  const anchor = monotonicNow();
  let elapsed = offset;
  return () => {
    elapsed = Math.max(elapsed, offset + Math.max(0, monotonicNow() - anchor));
    return Math.floor(elapsed);
  };
}
