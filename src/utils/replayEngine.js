import { applyWritingEvent, getWritingTimeline } from "./writingHistory.js";
import { applyChangeToOriginRanges, isPasteOriginEvent } from "./characterOrigins.js";
export { applyWritingEvent } from "./writingHistory.js";

export function replayUntil(eventLog = [], timestampMs) {
  const events = getWritingTimeline(eventLog);
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

export function createReplayIndex(eventLog = [], pasteEvents = []) {
  const events = getWritingTimeline(eventLog);
  let length = 0;
  const maxLength = events.reduce((max, event) => {
    length += (event.inserted_text ?? event.pasted_text ?? "").length - (event.deleted_character_count || 0);
    return Math.max(max, length);
  }, 1);
  // At most 64 checkpoints, and roughly two million stored text characters.
  const checkpointCount = Math.max(1, Math.min(64, Math.floor(2_000_000 / maxLength)));
  const stride = Math.max(64, Math.ceil(events.length / checkpointCount));
  const pasted = events.map((event) => isPasteOriginEvent(event, pasteEvents));
  const checkpoints = [{ eventCount: 0, text: "", originRanges: [], lastEvent: null }];
  function apply(state, index) {
    const event = events[index];
    return {
      eventCount: index + 1,
      text: applyWritingEvent(state.text, event),
      originRanges: applyChangeToOriginRanges(state.originRanges, event, state.text.length, pasted[index]),
      lastEvent: event,
    };
  }
  let state = checkpoints[0];
  for (let index = 0; index < events.length; index++) {
    state = apply(state, index);
    if ((index + 1) % stride === 0 || index + 1 === events.length) checkpoints.push(state);
  }
  let previous = checkpoints[0];
  return {
    events,
    checkpointCount: checkpoints.length,
    maxEventsPerSeek: stride,
    seek(timestampMs) {
      let low = 0;
      let high = events.length;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (events[mid].timestamp_ms <= timestampMs) low = mid + 1;
        else high = mid;
      }
      const end = low;
      if (previous.eventCount === end) return previous;
      const checkpoint = checkpoints[Math.min(Math.floor(end / stride), checkpoints.length - 1)];
      state = previous.eventCount <= end && previous.eventCount >= checkpoint.eventCount ? previous : checkpoint;
      for (let index = state.eventCount; index < end; index++) state = apply(state, index);
      previous = state;
      return state;
    },
  };
}
