export function applyWritingEvent(text, event) {
  const position = Math.max(0, Math.min(text.length, event.position || 0));
  const deletedCount = event.deleted_character_count || 0;
  const insertedText = event.inserted_text || event.pasted_text || "";

  if (event.event_type === "delete") {
    return text.slice(0, position) + text.slice(position + deletedCount);
  }

  if (event.event_type === "replace") {
    return (
      text.slice(0, position) +
      insertedText +
      text.slice(position + deletedCount)
    );
  }

  return text.slice(0, position) + insertedText + text.slice(position);
}

export function replayUntil(eventLog = [], timestampMs) {
  const events = [...eventLog].sort((a, b) => a.timestamp_ms - b.timestamp_ms);
  let text = "";
  let lastEvent = null;

  for (const event of events) {
    if (event.timestamp_ms > timestampMs) break;
    text = applyWritingEvent(text, event);
    lastEvent = event;
  }

  return { text, lastEvent };
}

export function getReplayDuration(eventLog = []) {
  return eventLog.reduce(
    (max, event) => Math.max(max, event.timestamp_ms || 0),
    0
  );
}
