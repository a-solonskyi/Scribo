import { applyWritingEvent, getWritingTimeline } from "./writingHistory.js";
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
