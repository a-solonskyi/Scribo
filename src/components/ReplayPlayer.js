import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";

import { getReplayDuration } from "../utils/replayEngine";
import { formatDuration } from "../utils/timeFormatting";

const SPEEDS = [1, 2, 5, 10, 20];

function getEventCharacterVolume(event) {
  return (
    (event.inserted_text || event.pasted_text || "").length +
    (event.deleted_character_count || 0)
  );
}

function getReplayHistogram(eventLog = [], durationMs = 0) {
  const bucketCount = Math.max(24, Math.min(96, Math.ceil(durationMs / 2500) || 24));
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    index,
    value: 0,
  }));

  for (const event of eventLog) {
    const timestamp = Math.max(0, event.timestamp_ms || 0);
    const index = Math.min(
      bucketCount - 1,
      Math.floor((timestamp / Math.max(1, durationMs)) * bucketCount)
    );
    buckets[index].value += getEventCharacterVolume(event);
  }

  const maxValue = Math.max(1, ...buckets.map((bucket) => bucket.value));
  return buckets.map((bucket) => ({
    ...bucket,
    height: bucket.value > 0 ? Math.max(10, (bucket.value / maxValue) * 100) : 0,
  }));
}

export default function ReplayPlayer({
  eventLog,
  timeMs: controlledTimeMs,
  onTimeChange,
  onReplayTouch,
}) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [internalTimeMs, setInternalTimeMs] = useState(0);
  const timeMs = controlledTimeMs ?? internalTimeMs;
  const durationMs = useMemo(() => getReplayDuration(eventLog), [eventLog]);
  const histogram = useMemo(
    () => getReplayHistogram(eventLog, durationMs),
    [eventLog, durationMs]
  );

  function updateTime(nextTime) {
    if (onTimeChange) onTimeChange(nextTime);
    else setInternalTimeMs(nextTime);
  }

  useEffect(() => {
    if (!playing) return undefined;

    const startedAt = Date.now();
    const baseTime = timeMs;
    const timer = window.setInterval(() => {
      const nextTime = Math.min(
        durationMs,
        baseTime + (Date.now() - startedAt) * speed
      );
      updateTime(nextTime);
      if (nextTime >= durationMs) setPlaying(false);
    }, 120);

    return () => window.clearInterval(timer);
  }, [playing, speed, timeMs, durationMs]);

  function reset() {
    setPlaying(false);
    onReplayTouch?.();
    updateTime(0);
  }

  function skipToEnd() {
    setPlaying(false);
    onReplayTouch?.();
    updateTime(durationMs);
  }

  if (!eventLog.length) return <p className="empty-state">No replay data.</p>;

  return (
    <div className="replay-player">
      <div className="replay-controls">
        <button
          className="replay-icon-button"
          type="button"
          onClick={() => {
            onReplayTouch?.();
            setPlaying(!playing);
          }}
          aria-label={playing ? "Pause replay" : "Play replay"}
          title={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <Pause aria-hidden="true" />
          ) : (
            <Play className="replay-play-icon" aria-hidden="true" />
          )}
        </button>
        <button
          className="replay-icon-button"
          type="button"
          onClick={reset}
          aria-label="Reset replay"
          title="Reset"
        >
          <RotateCcw aria-hidden="true" />
        </button>
        <button
          className="replay-icon-button"
          type="button"
          onClick={skipToEnd}
          aria-label="Skip to end"
          title="Skip to end"
        >
          <SkipForward aria-hidden="true" />
        </button>
        <div className="speed-controls">
          {SPEEDS.map((item) => (
            <button
              className={speed === item ? "speed active" : "speed"}
              key={item}
              type="button"
              onClick={() => setSpeed(item)}
            >
              {item}x
            </button>
          ))}
        </div>
        <span>{formatDuration(timeMs)}</span>
      </div>
      <div className="replay-scrubber">
        <div className="replay-histogram" aria-hidden="true">
          {histogram.map((bucket) => (
            <span
              className="replay-histogram-bar"
              key={bucket.index}
              style={{ height: `${bucket.height}%` }}
            />
          ))}
        </div>
        <input
          className="progress-range"
          type="range"
          min="0"
          max={durationMs}
          value={timeMs}
          onChange={(event) => {
            onReplayTouch?.();
            updateTime(Number(event.target.value));
          }}
        />
      </div>
    </div>
  );
}
