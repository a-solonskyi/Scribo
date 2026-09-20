import {
  getHighlightedHtml,
  getHighlightedSegments,
} from "../utils/pasteHighlighting";

export default function HighlightedEssayText({
  text,
  html,
  pasteEvents,
  eventLog,
  originRanges = null,
  originsAuthoritative = false,
}) {
  const highlightedHtml = getHighlightedHtml(
    html,
    pasteEvents,
    eventLog,
    text,
    originRanges
  );

  if (highlightedHtml) {
    return (
      <div
        className="essay-display formatted"
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      />
    );
  }

  const segments = originsAuthoritative && !originRanges?.length
    ? [{ text, pasted: false }]
    : getHighlightedSegments(
    text,
    pasteEvents,
    eventLog,
    originRanges
  );

  return (
    <div className="essay-display">
      {segments.map((segment, index) => (
        <span
          className={segment.pasted ? "pasted-segment" : undefined}
          key={`${index}-${segment.text.slice(0, 8)}`}
        >
          {segment.text}
        </span>
      ))}
    </div>
  );
}
