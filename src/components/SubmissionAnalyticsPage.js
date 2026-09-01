import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getSubmission } from "../sites/database";
import {
  countOriginRanges,
  getEffectivePasteEvents,
} from "../utils/characterOrigins";
import { getPasteRangesForText } from "../utils/pasteHighlighting";
import { replayUntil } from "../utils/replayEngine";
import { formatDateTime } from "../utils/timeFormatting";
import ActivityTimeline from "./ActivityTimeline";
import HighlightedEssayText from "./HighlightedEssayText";
import { ErrorState, LoadingState } from "./LoadingState";
import OverviewCharts from "./OverviewCharts";
import PasteEventsPanel from "./PasteEventsPanel";
import PauseEventsPanel from "./PauseEventsPanel";
import ProcessMetrics from "./ProcessMetrics";
import ReplayPlayer from "./ReplayPlayer";
import ResponseTab from "./ResponseTab";
import StatsCards from "./StatsCards";

function getEstimatedStartTime(submission, stats) {
  if (stats.firstEventAtMs === null || stats.firstEventAtMs === undefined) {
    return null;
  }

  const submittedAt = new Date(submission.submitted_at).getTime();
  const lastEventAtMs = stats.lastEventAtMs ?? stats.writingDurationMs ?? 0;
  const writingSpanMs = Math.max(0, lastEventAtMs - stats.firstEventAtMs);
  return new Date(submittedAt - writingSpanMs);
}

export default function SubmissionAnalyticsPage({ session }) {
  const { submissionId } = useParams();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [replayTimeMs, setReplayTimeMs] = useState(0);
  const [replayTouched, setReplayTouched] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        setSubmission(await getSubmission(submissionId));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [submissionId]);

  if (loading) return <LoadingState label="Loading submission" />;

  if (!submission) {
    return <ErrorState message={error || "Submission not found."} />;
  }

  const eventLog = submission.event_log_json || [];
  const recordedPasteEvents = submission.paste_events_json || [];
  const pauseEvents = submission.pause_events_json || [];
  const stats = submission.stats_json || {};
  const pasteEvents = getEffectivePasteEvents(eventLog, recordedPasteEvents);
  const storedOriginRanges =
    stats.pasteDetectionVersion >= 2 && Array.isArray(stats.pasteOriginRanges)
      ? stats.pasteOriginRanges
      : null;
  const finalPasteOriginRanges = getPasteRangesForText(
    submission.final_text || "",
    pasteEvents,
    eventLog,
    storedOriginRanges
  );
  const finalPastedCharacters = countOriginRanges(
    finalPasteOriginRanges,
    (submission.final_text || "").length
  );
  const totalDetectedPastedCharacters = pasteEvents.reduce(
    (sum, paste) =>
      sum +
      (paste.character_count ||
        (paste.pasted_text || paste.pastedText || "").length),
    0
  );
  const displayStats = {
    ...stats,
    pasteEventCount: pasteEvents.length,
    totalPastedCharacters: totalDetectedPastedCharacters,
    finalPastedCharacters,
  };
  const replay = replayUntil(eventLog, replayTimeMs);
  const visibleEssayText = replayTouched ? replay.text : submission.final_text;
  const visibleEssayHtml = replayTouched
    ? ""
    : stats.finalHtml || submission.final_html || "";
  const visiblePasteEvents = replayTouched
    ? pasteEvents.filter((event) => (event.timestamp_ms || 0) <= replayTimeMs)
    : pasteEvents;
  const visibleEventLog = replayTouched
    ? eventLog.filter((event) => (event.timestamp_ms || 0) <= replayTimeMs)
    : eventLog;
  const visibleOriginRanges = replayTouched ? null : finalPasteOriginRanges;
  const estimatedStartTime = getEstimatedStartTime(submission, displayStats);
  const tabs = [
    ["overview", "Overview"],
    ["essay", "Essay text"],
    ["response", "Response"],
    ["events", "Events"],
    ["technical", "Technical details"],
  ];

  return (
    <section className="page-section analytics-page">
      <Link
        className="text-button compact-back-link"
        to={`/assignment/${submission.assignment_id}`}
        aria-label="Back to submissions"
      >
        &lt;
      </Link>
      <div className="page-header">
        <div>
          <h1>{submission.student_name}</h1>
          <p>
            <span>{submission.assignments?.topic}</span>
            {estimatedStartTime ? (
              <>
                {" - "}
                <strong>started</strong> {formatDateTime(estimatedStartTime)}
              </>
            ) : null}
            {" - "}
            <strong>submitted</strong>{" "}
            {formatDateTime(submission.submitted_at)}
          </p>
        </div>
      </div>
      <ErrorState message={error} />

      <nav className="analytics-tabs" aria-label="Submission analytics sections">
        {tabs.map(([id, label]) => (
          <button
            className={activeTab === id ? "active" : undefined}
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" ? (
        <>
          <StatsCards stats={displayStats} />
          <OverviewCharts eventLog={eventLog} stats={displayStats} />
          <ProcessMetrics submission={submission} stats={displayStats} />
        </>
      ) : null}

      {activeTab === "essay" ? (
        <div className="analytics-grid compact-grid">
          <section className="analysis-panel wide">
            <h2>Replay writing process</h2>
            <ReplayPlayer
              eventLog={eventLog}
              timeMs={replayTimeMs}
              onTimeChange={setReplayTimeMs}
              onReplayTouch={() => setReplayTouched(true)}
            />
          </section>

          <section className="analysis-panel wide">
            <h2>Essay text</h2>
            <HighlightedEssayText
              text={visibleEssayText}
              html={visibleEssayHtml}
              pasteEvents={visiblePasteEvents}
              eventLog={visibleEventLog}
              originRanges={visibleOriginRanges}
            />
          </section>

          <details className="details-panel timeline-details analysis-panel wide">
            <summary>Writing process timeline</summary>
            <ActivityTimeline
              eventLog={eventLog}
              pasteEvents={pasteEvents}
              pauseEvents={pauseEvents}
              currentTimeMs={replayTimeMs}
              interactive={replayTouched}
            />
          </details>
        </div>
      ) : null}

      {activeTab === "response" ? (
        <ResponseTab
          submission={submission}
          professorId={session?.user?.id || submission.assignments?.professor_id}
        />
      ) : null}

      {activeTab === "events" ? (
      <div className="analytics-grid compact-grid">
        <section className="analysis-panel">
          <h2>Paste activity</h2>
          <PasteEventsPanel pasteEvents={pasteEvents} />
        </section>

        <section className="analysis-panel">
          <h2>Pause events</h2>
          <PauseEventsPanel pauseEvents={pauseEvents} />
        </section>
      </div>
      ) : null}

      {activeTab === "technical" ? (
        <ProcessMetrics
          submission={submission}
          stats={displayStats}
          mode="technical"
          eventLog={eventLog}
          pasteEvents={pasteEvents}
        />
      ) : null}
    </section>
  );
}
