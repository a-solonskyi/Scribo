import { formatDuration } from "../utils/timeFormatting";

export default function PauseEventsPanel({ pauseEvents }) {
  if (!pauseEvents.length) {
    return <p className="empty-state">No pauses over 5 seconds recorded.</p>;
  }

  return (
    <div className="event-panel">
      {pauseEvents.map((event, index) => (
        <div className="event-row compact" key={`${event.start_ms}-${index}`}>
          <span>
            {formatDuration(event.start_ms)} to {formatDuration(event.end_ms)}
          </span>
          <strong>{formatDuration(event.duration_ms)}</strong>
        </div>
      ))}
    </div>
  );
}
