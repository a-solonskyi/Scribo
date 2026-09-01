import ActivityTimeline from "./ActivityTimeline";
import { formatNumber } from "../utils/textStats";
import { formatClock, formatDuration } from "../utils/sessionAnalytics";

function StatCard({ label, value, detail }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      {detail ? <span className="stat-detail">{detail}</span> : null}
    </div>
  );
}

function ProcessRow({ label, value }) {
  return (
    <div className="process-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function StatsPanel({
  textStats,
  analytics,
  pauseThresholdMs,
  onCopySummary,
}) {
  return (
    <aside className="stats-panel" aria-label="Writing statistics">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Live statistics</p>
          <h2>Writing process</h2>
        </div>
        <button className="secondary-button compact-button" onClick={onCopySummary}>
          Copy
        </button>
      </div>

      <div className="stat-grid">
        <StatCard label="Words" value={formatNumber(textStats.wordCount)} />
        <StatCard
          label="Characters"
          value={formatNumber(textStats.characterCount)}
        />
        <StatCard
          label="No spaces"
          value={formatNumber(textStats.characterCountNoSpaces)}
        />
        <StatCard
          label="Session"
          value={formatDuration(analytics.sessionDurationMs)}
        />
      </div>

      <div className="process-list">
        <ProcessRow
          label="First keystroke"
          value={formatClock(analytics.firstKeystrokeAt)}
        />
        <ProcessRow
          label="Last keystroke"
          value={formatClock(analytics.lastKeystrokeAt)}
        />
        <ProcessRow
          label="Active writing time"
          value={formatDuration(analytics.activeWritingTimeMs)}
        />
        <ProcessRow
          label="Words / active min"
          value={formatNumber(analytics.wordsPerMinute)}
        />
        <ProcessRow
          label="Deleted characters"
          value={formatNumber(analytics.deletedCharacters)}
        />
        <ProcessRow
          label="Revision ratio"
          value={`${formatNumber(analytics.revisionRatio * 100)}%`}
        />
        <ProcessRow
          label={`Pauses over ${formatDuration(pauseThresholdMs)}`}
          value={formatNumber(analytics.pauses.length)}
        />
        <ProcessRow
          label="Longest pause"
          value={formatDuration(analytics.longestPauseMs)}
        />
        <ProcessRow
          label="Typing bursts"
          value={formatNumber(analytics.typingBursts.length)}
        />
        <ProcessRow
          label="Paste events"
          value={formatNumber(analytics.pasteSummary.count)}
        />
        <ProcessRow
          label="Pasted characters"
          value={formatNumber(analytics.pasteSummary.totalCharacters)}
        />
        <ProcessRow
          label="Largest paste"
          value={formatNumber(analytics.pasteSummary.largestPaste)}
        />
      </div>

      <div className="timeline-section">
        <div className="section-heading">
          <h3>Activity timeline</h3>
          <span>10-second buckets</span>
        </div>
        <ActivityTimeline timeline={analytics.timeline} compact />
      </div>
    </aside>
  );
}
