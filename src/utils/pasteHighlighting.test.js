import assert from "node:assert/strict";
import test from "node:test";

import { getHighlightedSegments } from "./pasteHighlighting.js";

test("uses exact saved character-origin ranges", () => {
    const segments = getHighlightedSegments(
      "abcNEWdef",
      [],
      [],
      [
        { start: 0, end: 3 },
        { start: 6, end: 9 },
      ]
    );

    assert.deepEqual(segments.map(({ text, pasted }) => ({ text, pasted })), [
      { text: "abc", pasted: true },
      { text: "NEW", pasted: false },
      { text: "def", pasted: true },
    ]);
});

test("recovers pasted ranges when a legacy saved range list is empty", () => {
  const text = "Typed first. Pasted paragraph.";
  const eventLog = [
    {
      timestamp_ms: 100,
      event_type: "insert",
      position: 0,
      inserted_text: "Typed first. ",
      deleted_character_count: 0,
    },
    {
      timestamp_ms: 200,
      event_type: "paste",
      position: 13,
      inserted_text: "Pasted paragraph.",
      deleted_character_count: 0,
    },
  ];

  const segments = getHighlightedSegments(text, [], eventLog, []);

  assert.deepEqual(segments.map(({ text: value, pasted }) => ({ text: value, pasted })), [
    { text: "Typed first. ", pasted: false },
    { text: "Pasted paragraph.", pasted: true },
  ]);
});
