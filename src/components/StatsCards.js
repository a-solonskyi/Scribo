import { formatDuration, formatNumber } from "../utils/timeFormatting";

export default function StatsCards({ stats }) {
  const cards = [
    ["Words", formatNumber(stats.wordCount)],
    ["Characters", formatNumber(stats.characterCount)],
    ["Characters no spaces", formatNumber(stats.characterCountNoSpaces)],
    ["Deleted characters", formatNumber(stats.deletedCharacters)],
    ["Active time", formatDuration(stats.activeWritingTimeMs)],
    ["Duration", formatDuration(stats.writingDurationMs)],
    [
      "WPM active / total",
      `${formatNumber(stats.wordsPerActiveMinute, 1)} / ${formatNumber(
        stats.wordsPerTotalMinute,
        1
      )}`,
    ],
    [
      "Pasted chars",
      formatNumber(
        stats.finalPastedCharacters ?? stats.totalPastedCharacters
      ),
    ],
  ];

  return (
    <div className="stats-grid">
      {cards.map(([label, value]) => (
        <div className="stat-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
