import { formatDuration, formatNumber } from "../utils/timeFormatting";

export default function PasteEventsPanel({ pasteEvents }) {
  if (!pasteEvents.length) {
    return <p className="empty-state">No paste events recorded.</p>;
  }

  return (
    <div className="event-panel">
      {pasteEvents.map((event, index) => (
        <div className="event-row" key={`${event.timestamp_ms}-${index}`}>
          <span>{formatDuration(event.timestamp_ms)}</span>
          <strong>{formatNumber(event.character_count)} chars</strong>
          <p>{event.pasted_text || "Pasted text not available"}</p>
        </div>
      ))}
    </div>
  );
}
