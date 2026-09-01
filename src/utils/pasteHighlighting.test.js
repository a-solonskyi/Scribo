import assert from "node:assert/strict";
import test from "node:test";

import {
  collectFormattedTextNodes,
  getHighlightedSegments,
} from "./pasteHighlighting.js";

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

test("preserves paragraph separators when indexing formatted essay text", () => {
  const previousWindow = globalThis.window;
  globalThis.window = {
    Node: {
      ELEMENT_NODE: 1,
      TEXT_NODE: 3,
    },
  };

  const typedNode = {
    nodeType: 3,
    nodeValue: "Typed paragraph",
  };
  const pastedNode = {
    nodeType: 3,
    nodeValue: "Pasted paragraph",
  };
  const root = {
    childNodes: [
      {
        nodeType: 1,
        tagName: "P",
        childNodes: [typedNode],
      },
      {
        nodeType: 1,
        tagName: "P",
        childNodes: [
          {
            nodeType: 1,
            tagName: "STRONG",
            childNodes: [pastedNode],
          },
        ],
      },
    ],
  };
  const textNodes = [];

  try {
    assert.equal(
      collectFormattedTextNodes(root, textNodes),
      "Typed paragraph\n\nPasted paragraph"
    );
    assert.deepEqual(textNodes.map(({ start, end }) => ({ start, end })), [
      { start: 0, end: 15 },
      { start: 17, end: 33 },
    ]);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
