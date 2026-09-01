import { getReplayDuration } from "../utils/replayEngine";
import { formatDuration, formatNumber } from "../utils/timeFormatting";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function polarToCartesian(centerX, centerY, radius, angleDegrees) {
  const angleRadians = ((angleDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleRadians),
    y: centerY + radius * Math.sin(angleRadians),
  };
}

function describeArc(centerX, centerY, radius, startAngle, endAngle) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    centerX,
    centerY,
    "L",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
    "Z",
  ].join(" ");
}

function getCharacterPoints(eventLog = [], finalCharacters = 0) {
  const sortedEvents = [...eventLog].sort(
    (a, b) => (a.timestamp_ms || 0) - (b.timestamp_ms || 0)
  );
  const durationMs = Math.max(1000, getReplayDuration(sortedEvents));
  const points = [{ timeMs: 0, characters: 0 }];

  for (const event of sortedEvents) {
    points.push({
      timeMs: clamp(event.timestamp_ms || 0, 0, durationMs),
      characters: clamp(event.current_text_length || 0, 0, Math.max(finalCharacters, 1)),
    });
  }

  if (points.at(-1)?.timeMs !== durationMs || points.at(-1)?.characters !== finalCharacters) {
    points.push({ timeMs: durationMs, characters: finalCharacters });
  }

  return { points, durationMs };
}

function getLinePath(points, durationMs, maxCharacters) {
  const x0 = 38;
  const x1 = 402;
  const y0 = 44;
  const y1 = 256;

  return points
    .map((point, index) => {
      const x = x0 + (point.timeMs / durationMs) * (x1 - x0);
      const y = y1 - (point.characters / maxCharacters) * (y1 - y0);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function PastedCharacterPie({ stats }) {
  const totalCharacters = Math.max(0, stats.characterCount || 0);
  const pastedCharacters = clamp(
    stats.finalPastedCharacters ?? stats.totalPastedCharacters ?? 0,
    0,
    Math.max(totalCharacters, 0)
  );
  const pastedShare = totalCharacters > 0 ? pastedCharacters / totalCharacters : 0;
  const pastedAngle = pastedShare * 360;
  const hasPastedSlice = pastedCharacters > 0 && totalCharacters > 0;
  const otherCharacters = Math.max(0, totalCharacters - pastedCharacters);

  return (
    <section className="overview-chart-card">
      <div className="chart-heading">
        <h2>Character composition</h2>
        <span>{formatNumber(totalCharacters)} total chars</span>
      </div>
      <svg
        className="overview-pie-chart"
        viewBox="0 0 220 138"
        role="img"
        aria-label="Pasted and non-pasted character share"
      >
        <defs>
          <pattern
            id="pasted-diagonal-pattern"
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="5" height="5" fill="#f2f2f2" />
            <line x1="0" y1="0" x2="0" y2="5" stroke="#666666" strokeWidth="1" />
          </pattern>
        </defs>
        <circle className="pie-base" cx="96" cy="70" r="52" />
        {pastedShare >= 0.999 ? (
          <circle className="pie-pasted-slice" cx="96" cy="70" r="52" />
        ) : hasPastedSlice ? (
          <path
            className="pie-pasted-slice"
            d={describeArc(96, 70, 52, 0, pastedAngle)}
          />
        ) : null}
        <circle className="pie-ring" cx="96" cy="70" r="52" />
      </svg>
      <div className="chart-legend">
        <span>
          <i className="legend-swatch plain" /> Original or edited:{" "}
          {formatNumber(otherCharacters)} chars (
          {formatNumber((1 - pastedShare) * 100, 1)}%)
        </span>
        <span>
          <i className="legend-swatch solid" /> Pasted:{" "}
          {formatNumber(pastedCharacters)} chars (
          {formatNumber(pastedShare * 100, 1)}%)
        </span>
      </div>
    </section>
  );
}

function CharacterTimeLine({ eventLog, stats }) {
  const finalCharacters = Math.max(0, stats.characterCount || 0);
  const { points, durationMs } = getCharacterPoints(eventLog, finalCharacters);
  const maxCharacters = Math.max(1, finalCharacters, ...points.map((point) => point.characters));
  const actualPath = getLinePath(points, durationMs, maxCharacters);

  return (
    <section className="overview-chart-card">
      <div className="chart-heading">
        <h2>Characters over time</h2>
        <span>{formatDuration(durationMs)}</span>
      </div>
      <svg
        className="overview-line-chart"
        viewBox="0 0 420 284"
        role="img"
        aria-label="Character count over time"
      >
        <text x="0" y="28" className="axis-label">Characters</text>
        <text x="350" y="278" className="axis-label">Time</text>
        <text x="8" y="60" className="axis-value">{formatNumber(maxCharacters)}</text>
        <text x="28" y="274" className="axis-value">0</text>
        <line x1="38" y1="44" x2="38" y2="256" className="axis-line" />
        <line x1="38" y1="256" x2="402" y2="256" className="axis-line" />
        <line x1="38" y1="256" x2="402" y2="44" className="reference-line" />
        <path d={actualPath} className="character-line" />
        <circle
          cx="402"
          cy={256 - (finalCharacters / maxCharacters) * 212}
          r="4.5"
          className="word-curve-dot"
        />
      </svg>
    </section>
  );
}

export default function OverviewCharts({ eventLog = [], stats = {} }) {
  return (
    <div className="overview-charts">
      <PastedCharacterPie stats={stats} />
      <CharacterTimeLine eventLog={eventLog} stats={stats} />
    </div>
  );
}
