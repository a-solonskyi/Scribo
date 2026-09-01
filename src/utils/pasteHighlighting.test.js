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
