import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildResponseSegments,
  validateResponseAnnotation,
} from './responseAnnotations.js';

test('overlapping notes and highlights preserve exact UTF-16 text and all feedback anchors', () => {
  const text = 'A📚\n\nУкраїнське есе';
  const annotations = [
    { id: 'h', type: 'highlight', start_offset: 0, end_offset: 10 },
    { id: 'c1', type: 'comment', start_offset: 1, end_offset: 3 },
    { id: 'c2', type: 'comment', start_offset: 1, end_offset: 5 },
    {
      id: 'n',
      type: 'note',
      start_offset: text.length,
      end_offset: text.length,
    },
    { id: 'old-drawing', type: 'drawing' },
  ];
  const snapshot = JSON.stringify(annotations);
  const segments = buildResponseSegments(text, annotations);
  assert.equal(segments.map((s) => s.text).join(''), text);
  assert.deepEqual(
    segments.find((s) => s.text === '📚').annotations.map((a) => a.id),
    ['h', 'c1', 'c2'],
  );
  assert.equal(segments.at(-1).notes[0].id, 'n');
  assert.equal(JSON.stringify(annotations), snapshot);
});

test('point notes validate finite positions and ranges while retired drawing requests are rejected', () => {
  const body = {
    type: 'note',
    start_offset: 2,
    end_offset: 2,
    comment_text: ' Note ',
    note_position: { xRatio: 0.4, lineOffset: 0.2 },
  };
  const result = validateResponseAnnotation(body, 'Essay');
  assert.equal(result.value.commentText, 'Note');
  for (const change of [
    { start_offset: -1 },
    { end_offset: 3 },
    { comment_text: '' },
    { note_position: { xRatio: Infinity, lineOffset: 0 } },
    { type: 'drawing' },
  ]) {
    assert.ok(
      validateResponseAnnotation({ ...body, ...change }, 'Essay').error,
    );
  }
  const comment = validateResponseAnnotation(
    {
      type: 'comment',
      start_offset: 1,
      end_offset: 3,
      text_quote: 'forged',
      comment_text: 'Read this',
    },
    'A📚 essay',
  ).value;
  assert.equal(comment.textQuote, '📚');
  assert.equal(comment.color, 'blue');
});
