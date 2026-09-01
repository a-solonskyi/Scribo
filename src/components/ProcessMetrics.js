import { formatDateTime, formatDuration, formatNumber } from "../utils/timeFormatting";

function countInsertedSpaces(eventLog = []) {
  return eventLog.reduce((sum, event) => {
    const inserted = event.inserted_text || event.pasted_text || "";
    return sum + (inserted.match(/\s/gu) || []).length;
  }, 0);
}

function countTypingBursts(eventLog = [], gapMs = 10000) {
  const writingEvents = eventLog
    .filter((event) => ["insert", "paste", "replace"].includes(event.event_type))
    .sort((a, b) => a.timestamp_ms - b.timestamp_ms);

  if (!writingEvents.length) return 0;

  return writingEvents.reduce((count, event, index) => {
    if (index === 0) return 1;
    const previous = writingEvents[index - 1];
    return event.timestamp_ms - previous.timestamp_ms > gapMs ? count + 1 : count;
  }, 0);
}

function MetricTable({ rows }) {
  return (
    <div className="metric-table compact">
      {rows.map(([label, value]) => (
        <div className="metric-row" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function TechnicalSection({ title, rows }) {
  return (
    <section className="metric-table-section technical-section">
      <h2>{title}</h2>
      <MetricTable rows={rows} />
    </section>
  );
}

export default function ProcessMetrics({
  submission,
  stats,
  mode = "session",
  eventLog = [],
  pasteEvents = [],
}) {
  const firstEventMs = stats.firstEventAtMs;
  const lastEventMs = stats.lastEventAtMs;

  if (mode === "technical") {
    return (
      <div className="process-metrics compact">
        <TechnicalSection
          title="Writing Process"
          rows={[
            ["Active writing time", formatDuration(stats.activeWritingTimeMs)],
            ["Idle time", formatDuration(stats.idleTimeMs)],
            ["Words per total minute", formatNumber(stats.wordsPerTotalMinute, 1)],
            ["Words per active minute", formatNumber(stats.wordsPerActiveMinute, 1)],
            ["Deleted characters", formatNumber(stats.deletedCharacters)],
            ["Inserted spaces", formatNumber(countInsertedSpaces(eventLog))],
            ["Revision ratio", `${formatNumber((stats.revisionRatio || 0) * 100, 1)}%`],
            ["Pauses over 5s", formatNumber(stats.pauseCount)],
            ["Longest pause", formatDuration(stats.longestPauseMs)],
            ["Average pause", formatDuration(stats.averagePauseMs)],
            ["Typing bursts", formatNumber(countTypingBursts(eventLog))],
          ]}
        />

        <TechnicalSection
          title="Paste activity"
          rows={[
            ["Paste events", formatNumber(stats.pasteEventCount)],
            ["Total pasted characters", formatNumber(stats.totalPastedCharacters)],
            ["Largest paste event", formatNumber(stats.largestPasteEvent)],
            ["Listed paste records", formatNumber(pasteEvents.length)],
          ]}
        />

        <details className="details-panel">
          <summary>Technical IDs</summary>
          <MetricTable rows={[
            ["Submission ID", submission.id],
            ["Assignment ID", submission.assignment_id],
          ]} />
        </details>
      </div>
    );
  }

  return (
    <div className="process-metrics compact">
      <details className="details-panel">
        <summary>Session details</summary>
        <MetricTable
          rows={[
            ["Essay topic", submission.assignments?.topic || submission.title || "Untitled"],
            ["Student", submission.student_name],
            ["Submitted", formatDateTime(submission.submitted_at)],
            [
              "First keystroke",
              firstEventMs === null || firstEventMs === undefined
                ? "Not recorded"
                : `${formatDuration(firstEventMs)} after opening`,
            ],
            [
              "Last activity",
              lastEventMs === null || lastEventMs === undefined
                ? "Not recorded"
                : `${formatDuration(lastEventMs)} after opening`,
            ],
          ]}
        />
      </details>

    </div>
  );
}
