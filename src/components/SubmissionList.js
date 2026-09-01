import { Link } from "react-router-dom";

import { getEffectivePasteEvents } from "../utils/characterOrigins";
import { formatDateTime, formatDuration, formatNumber } from "../utils/timeFormatting";

export default function SubmissionList({ submissions, onDelete }) {
  if (!submissions.length) {
    return <p className="empty-state">No submissions yet.</p>;
  }

  return (
    <div className="submission-list">
      <div className="submission-row header">
        <span>Student</span>
        <span>Submitted</span>
        <span>Words</span>
        <span>Active writing</span>
        <span>Duration</span>
        <span>Paste events</span>
        <span>Delete</span>
      </div>
      {submissions.map((submission) => {
        const stats = submission.stats_json || {};
        const pasteEvents = getEffectivePasteEvents(
          submission.event_log_json || [],
          submission.paste_events_json || []
        );
        const pastedCharacters = pasteEvents.reduce(
          (sum, paste) =>
            sum +
            (paste.character_count ||
              (paste.pasted_text || paste.pastedText || "").length),
          0
        );
        return (
          <div
            className="submission-row"
            key={submission.id}
          >
            <Link className="submission-name-link" to={`/submission/${submission.id}`}>
              {submission.student_name}
            </Link>
            <span>{formatDateTime(submission.submitted_at)}</span>
            <span>{formatNumber(stats.wordCount)}</span>
            <span>{formatDuration(stats.activeWritingTimeMs)}</span>
            <span>{formatDuration(stats.writingDurationMs)}</span>
            <span>
              {formatNumber(pasteEvents.length)} /{" "}
              {formatNumber(pastedCharacters)} chars
            </span>
            <button
              className="delete-icon-button"
              type="button"
              aria-label={`Delete submission from ${submission.student_name}`}
              title="Delete submission"
              onClick={() => onDelete?.(submission)}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
