// Offsets always refer to the unchanged UTF-16 essay text, never to UI labels.
export function buildResponseSegments(text, annotations) {
  const ranges = annotations.filter(
    (a) =>
      ['highlight', 'comment'].includes(a.type) &&
      Number.isInteger(a.start_offset) &&
      Number.isInteger(a.end_offset) &&
      a.start_offset >= 0 &&
      a.end_offset > a.start_offset &&
      a.end_offset <= text.length,
  );
  const boundaries = new Set([0, text.length]);
  for (const a of ranges) {
    boundaries.add(a.start_offset);
    boundaries.add(a.end_offset);
  }
  for (const a of annotations.filter((a) => a.type === 'note')) {
    if (
      Number.isInteger(a.start_offset) &&
      a.start_offset >= 0 &&
      a.start_offset <= text.length
    )
      boundaries.add(a.start_offset);
  }
  const offsets = [...boundaries].sort((a, b) => a - b);
  return offsets.slice(0, -1).map((start, i) => {
    const end = offsets[i + 1];
    const active = ranges.filter(
      (a) => a.start_offset < end && a.end_offset > start,
    );
    return {
      start,
      end,
      text: text.slice(start, end),
      annotations: active,
      notes: annotations.filter(
        (a) =>
          a.type === 'note' &&
          Math.min(a.start_offset, Math.max(0, text.length - 1)) >= start &&
          Math.min(a.start_offset, Math.max(0, text.length - 1)) < end,
      ),
    };
  });
}

export function validateResponseAnnotation(body, text) {
  const type = body.type;
  if (!['highlight', 'comment', 'note'].includes(type))
    return { error: 'Annotation type is invalid.' };
  const start = body.start_offset,
    end = body.end_offset;
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end > text.length ||
    (type === 'note' ? end !== start : end <= start)
  )
    return { error: 'Text selection is invalid.' };
  const comment =
    typeof body.comment_text === 'string' ? body.comment_text.trim() : '';
  if (type !== 'highlight' && (!comment || comment.length > 10000))
    return { error: 'Enter a note of 1 to 10,000 characters.' };
  let position = null;
  if (type === 'note') {
    const p = body.note_position;
    if (
      !p ||
      !Number.isFinite(p.xRatio) ||
      p.xRatio < 0 ||
      p.xRatio > 1 ||
      !Number.isFinite(p.lineOffset) ||
      Math.abs(p.lineOffset) > 40
    )
      return { error: 'Note position is invalid.' };
    position = { version: 1, xRatio: p.xRatio, lineOffset: p.lineOffset };
  }
  return {
    value: {
      type,
      startOffset: start,
      endOffset: end,
      textQuote: type === 'note' ? null : text.slice(start, end).slice(0, 5000),
      commentText: type === 'highlight' ? null : comment,
      color: type === 'comment' ? 'blue' : 'yellow',
      position,
    },
  };
}
