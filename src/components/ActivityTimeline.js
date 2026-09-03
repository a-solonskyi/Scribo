import { useMemo } from "react";

import { getReplayDuration } from "../utils/replayEngine";
import { getActivityBuckets } from "../utils/writingAnalytics";
import { formatDuration } from "../utils/timeFormatting";

function getAdaptiveBucketMs(durationMs) {
  if (durationMs <= 3 * 60 * 1000) return 2000;
  if (durationMs <= 15 * 60 * 1000) return 5000;
  if (durationMs <= 45 * 60 * 1000) return 15000;
  return 30000;
}

function ActivityRow({ label, meta, tone, items, durationMs }) {
  return (
    <div className={`activity-row ${tone}`}>
      <div className="activity-row-label">
        <span>{label}</span>
        {meta ? <small>{meta}</small> : null}
      </div>
      <div className="activity-track">
        {items.map((item) => {
          const left = (item.startMs / durationMs) * 100;
          const width = Math.max(0.7, ((item.endMs - item.startMs) / durationMs) * 100);
          const height = Math.max(8, item.intensity || 0);
          return (
            <span
              className="activity-mark"
              key={item.key}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                height: `${height}%`,
              }}
              title={item.title}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function ActivityTimeline({
  eventLog,
  pasteEvents = [],
  pauseEvents = [],
  currentTimeMs = 0,
  interactive = false,
}) {
  const timelineEvents = useMemo(
    () => buildTimelineEvents(eventLog, pasteEvents),
    [eventLog, pasteEvents]
  );
  const timelineDurationMs = timelineEvents.reduce(
    (max, event) => Math.max(max, event.timestamp_ms || 0),
    0
  );
  const durationMs = Math.max(1000, getReplayDuration(eventLog), timelineDurationMs);
  const activeEndMs = interactive ? Math.min(currentTimeMs, durationMs) : durationMs;
  const visibleEvents = useMemo(
    () => timelineEvents.filter((event) => (event.timestamp_ms || 0) <= activeEndMs),
    [timelineEvents, activeEndMs]
  );
  const visiblePauses = useMemo(
    () => pauseEvents.filter((pause) => (pause.start_ms || 0) <= activeEndMs),
    [pauseEvents, activeEndMs]
  );
  const bucketMs = getAdaptiveBucketMs(durationMs);
  const buckets = getActivityBuckets(visibleEvents, bucketMs);
  const maxCharactersPerBucket = Math.max(
    1,
    ...buckets.flatMap((bucket) => [
      bucket.insertedCharacters,
      bucket.deletedCharacters,
      bucket.pastedCharacters,
    ])
  );
  const totalInserted = buckets.reduce(
    (sum, bucket) => sum + bucket.insertedCharacters,
    0
  );
  const totalDeleted = buckets.reduce(
    (sum, bucket) => sum + bucket.deletedCharacters,
    0
  );
  const totalPasted = buckets.reduce(
    (sum, bucket) => sum + bucket.pastedCharacters,
    0
  );
  const activePasteEvents = pasteEvents.filter(
    (event) => !interactive || (event.timestamp_ms || 0) <= activeEndMs
  );
  const playheadRatio = activeEndMs / durationMs;
  const playheadLeft = `calc(220px + ${playheadRatio * 100}% - ${
    playheadRatio * 220
  }px)`;

  if (!timelineEvents.length) return <p className="empty-state">No activity recorded.</p>;

  const insertedItems = buckets
    .filter((bucket) => bucket.insertedCharacters > 0)
    .map((bucket) => ({
      key: `insert-${bucket.index}`,
      startMs: bucket.startMs,
      endMs: bucket.endMs,
      intensity: (bucket.insertedCharacters / maxCharactersPerBucket) * 86,
      title: `${bucket.insertedCharacters} inserted characters`,
    }));

  const deletedItems = buckets
    .filter((bucket) => bucket.deletedCharacters > 0)
    .map((bucket) => ({
      key: `delete-${bucket.index}`,
      startMs: bucket.startMs,
      endMs: bucket.endMs,
      intensity: (bucket.deletedCharacters / maxCharactersPerBucket) * 86,
      title: `${bucket.deletedCharacters} deleted characters`,
    }));

  const pasteItems = buckets
    .filter((bucket) => bucket.pastedCharacters > 0)
    .map((bucket) => ({
      key: `paste-${bucket.index}`,
      startMs: bucket.startMs,
      endMs: bucket.endMs,
      intensity: Math.max(
        12,
        (bucket.pastedCharacters / maxCharactersPerBucket) * 86
      ),
      title: `${bucket.pastedCharacters} pasted characters`,
    }));

  const pauseItems = visiblePauses.map((pause, index) => ({
    key: `pause-${index}`,
    startMs: pause.start_ms || 0,
    endMs: Math.min(activeEndMs, pause.end_ms || pause.start_ms || 0),
    intensity: 86,
    title: `Pause: ${formatDuration(pause.duration_ms || 0)}`,
  }));

  return (
    <div className="activity-visualization">
      <section className="activity-timeline-card" aria-label="Writing activity timeline">
        <h3>Activity by time interval</h3>
        <p>
          Time runs left to right from 0s to {formatDuration(durationMs)}. Bucket size:{" "}
          {formatDuration(bucketMs)}.
        </p>
        <div className="activity-rows">
          <span className="activity-playhead" style={{ left: playheadLeft }} />
          <ActivityRow
            label="Inserted characters"
            meta={`${totalInserted} chars`}
            tone="insert"
            items={insertedItems}
            durationMs={durationMs}
          />
          <ActivityRow
            label="Deleted characters"
            meta={`${totalDeleted} chars`}
            tone="delete"
            items={deletedItems}
            durationMs={durationMs}
          />
          <ActivityRow
            label="Paste events"
            meta={`${activePasteEvents.length} events / ${totalPasted} chars`}
            tone="paste"
            items={pasteItems}
            durationMs={durationMs}
          />
          <ActivityRow
            label="Pauses > 5s"
            meta={`${visiblePauses.length} pauses`}
            tone="pause"
            items={pauseItems}
            durationMs={durationMs}
          />
          <div className="activity-axis">
            <span>Start</span>
            <span>End ({formatDuration(durationMs)})</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function buildTimelineEvents(eventLog = [], pasteEvents = []) {
  const matchedPasteIndexes = new Set();
  const convertedEvents = eventLog.map((event) => {
    const pasteIndex = findMatchingPasteIndex(event, pasteEvents);
    if (pasteIndex < 0) return event;

    matchedPasteIndexes.add(pasteIndex);
    const paste = pasteEvents[pasteIndex];
    const pastedText = paste.pasted_text || paste.pastedText || "";

    return {
      ...event,
      event_type: "paste",
      inserted_text: pastedText,
      pasted_text: pastedText,
    };
  });

  pasteEvents.forEach((paste, index) => {
    if (matchedPasteIndexes.has(index)) return;

    const pastedText = paste.pasted_text || paste.pastedText || "";
    convertedEvents.push({
      timestamp_ms: paste.timestamp_ms || 0,
      event_type: "paste",
      position: paste.position || 0,
      current_text_length: 0,
      inserted_text: pastedText,
      pasted_text: pastedText,
      deleted_character_count: 0,
    });
  });

  return convertedEvents.sort((a, b) => (a.timestamp_ms || 0) - (b.timestamp_ms || 0));
}

function findMatchingPasteIndex(event, pasteEvents) {
  if (event.event_type === "paste") {
    return pasteEvents.findIndex((paste) => {
      const pastedText = paste.pasted_text || paste.pastedText || "";
      const eventText = event.pasted_text || event.inserted_text || "";
      return (
        Math.abs((paste.timestamp_ms || 0) - (event.timestamp_ms || 0)) <= 1500 &&
        (!eventText || !pastedText || eventText.includes(pastedText) || pastedText.includes(eventText))
      );
    });
  }

  if (!event.inserted_text || !pasteEvents.length) return -1;

  return pasteEvents.findIndex((paste) => {
    const pastedText = paste.pasted_text || paste.pastedText || "";
    const timeClose =
      Math.abs((paste.timestamp_ms || 0) - (event.timestamp_ms || 0)) <= 1500;
    const lengthClose =
      Math.abs((pastedText.length || 0) - (event.inserted_text.length || 0)) <=
      Math.max(12, pastedText.length * 0.15);
    const textRelated =
      pastedText.includes(event.inserted_text) ||
      event.inserted_text.includes(pastedText) ||
      normalizeText(pastedText).includes(normalizeText(event.inserted_text)) ||
      normalizeText(event.inserted_text).includes(normalizeText(pastedText));

    return timeClose && (lengthClose || textRelated);
  });
}

function normalizeText(text = "") {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}
