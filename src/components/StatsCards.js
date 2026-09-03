import { useState } from "react";
import { X } from "lucide-react";

import { formatDuration, formatNumber } from "../utils/timeFormatting";

const WPM_REFERENCE_BARS = [8, 18, 38, 67, 90, 100, 83, 59, 38, 22, 13, 6];

const METRIC_INFO = {
  time: {
    title: "Time active / total",
    measured:
      "Active time is the first-to-last writing duration minus recorded pauses of at least 5 seconds. Total time is the full span between the first and last writing events.",
    tells:
      "The difference shows how much of the session was spent continuously writing or editing versus pausing. It cannot identify why a pause occurred.",
  },
  wpm: {
    title: "WPM active / total",
    measured:
      "Final word count is divided by active minutes for the first value and by total writing minutes for the second value.",
    tells:
      "The comparison shows writing pace while engaged and across the whole session. Essay composition differs from transcription, so the benchmark is context rather than a quality threshold.",
  },
  revision: {
    title: "Revision ratio",
    measured:
      "All deleted characters recorded during the session are divided by the final essay character count, then expressed as a percentage.",
    tells:
      "It indicates the amount of deletion-based reworking relative to the final text. A high or low ratio does not determine writing quality on its own.",
  },
  pause: {
    title: "Longest pause",
    measured:
      "This is the longest recorded gap of at least 5 seconds between writing events.",
    tells:
      "It can reflect planning, reading, interruption, or time away from the page. The writing record cannot determine the reason.",
  },
};

function WpmHistogram({ activeWpm }) {
  const markerPosition = Math.min(100, Math.max(0, ((activeWpm || 0) / 120) * 100));

  return (
    <div className="wpm-reference">
      <div className="wpm-reference-heading">
        <span>Typing-speed reference</span>
        <strong>Writer: {formatNumber(activeWpm, 1)} WPM</strong>
      </div>
      <figure
        className="wpm-histogram"
        aria-label={`Schematic typing-speed histogram with the writer at ${formatNumber(
          activeWpm,
          1
        )} words per minute`}
      >
        <div
          className="wpm-writer-marker"
          style={{ left: `${markerPosition}%` }}
          aria-hidden="true"
        />
        {WPM_REFERENCE_BARS.map((height, index) => (
          <span
            className="wpm-histogram-bar"
            key={index}
            style={{ height: `${height}%` }}
          />
        ))}
      </figure>
      <div className="wpm-histogram-axis" aria-hidden="true">
        <span>0</span>
        <span>30</span>
        <span>60</span>
        <span>90</span>
        <span>120 WPM</span>
      </div>
      <p className="wpm-reference-note">
        Schematic distribution based on the Aalto University finding that most
        observed typists were between 30 and 60 WPM, with an average near 52 WPM. {" "}
        <a
          href="https://www.aalto.fi/en/news/the-traits-of-fast-typists-discovered-by-analysing-136-million-keystrokes"
          target="_blank"
          rel="noreferrer"
        >
          Research reference
        </a>
      </p>
    </div>
  );
}

function MetricInfoPopover({ metric, activeWpm, onClose }) {
  const info = METRIC_INFO[metric];

  return (
    <dialog className="stat-info-popover" open aria-label={`${info.title} information`}>
      <button
        className="stat-info-close"
        type="button"
        onClick={onClose}
        aria-label={`Close ${info.title} information`}
      >
        <X aria-hidden="true" />
      </button>
      <h3>{info.title}</h3>
      <p><strong>How it is measured</strong>{info.measured}</p>
      <p><strong>What it can tell you</strong>{info.tells}</p>
      {metric === "wpm" ? <WpmHistogram activeWpm={activeWpm} /> : null}
    </dialog>
  );
}

export default function StatsCards({ stats }) {
  const [openMetric, setOpenMetric] = useState(null);
  const cards = [
    ["Words", formatNumber(stats.wordCount)],
    ["Characters", formatNumber(stats.characterCount)],
    ["Characters w/o spaces", formatNumber(stats.characterCountNoSpaces)],
    [
      "Pasted characters",
      formatNumber(stats.finalPastedCharacters ?? stats.totalPastedCharacters),
    ],
    [
      "Time active / total",
      `${formatDuration(stats.activeWritingTimeMs)} / ${formatDuration(stats.writingDurationMs)}`,
      "time",
    ],
    [
      "WPM active / total",
      `${formatNumber(stats.wordsPerActiveMinute, 1)} / ${formatNumber(
        stats.wordsPerTotalMinute,
        1
      )}`,
      "wpm",
    ],
    [
      "Revision ratio",
      `${formatNumber((stats.revisionRatio || 0) * 100, 1)}%`,
      "revision",
    ],
    ["Longest pause", formatDuration(stats.longestPauseMs), "pause"],
  ];

  return (
    <div className="stats-grid">
      {cards.map(([label, value, info]) => (
        <div className="stat-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          {info ? (
            <>
              <button
                className="stat-info-button"
                type="button"
                onClick={() => setOpenMetric(openMetric === info ? null : info)}
                aria-label={`Information about ${label}`}
                aria-expanded={openMetric === info}
                title={`Information about ${label}`}
              >
                i
              </button>
              {openMetric === info ? (
                <MetricInfoPopover
                  metric={info}
                  activeWpm={stats.wordsPerActiveMinute}
                  onClose={() => setOpenMetric(null)}
                />
              ) : null}
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}
