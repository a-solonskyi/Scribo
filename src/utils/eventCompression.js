export function trimEventLog(eventLog, maxEvents = 4000) {
  if (eventLog.length <= maxEvents) return eventLog;

  const importantEvents = eventLog.filter((event) =>
    ["paste", "delete", "replace"].includes(event.event_type)
  );
  const remainingSlots = Math.max(0, maxEvents - importantEvents.length);
  const sampledInserts = eventLog
    .filter((event) => event.event_type === "insert")
    .slice(-remainingSlots);

  return [...importantEvents, ...sampledInserts].sort(
    (a, b) => a.timestamp_ms - b.timestamp_ms
  );
}
