import assert from "node:assert/strict";
import test from "node:test";

import { createWritingEvent } from "./writingAnalytics.js";

test("records an editor paste transaction even without clipboard text", () => {
    const event = createWritingEvent({
      previousText: "Before ",
      nextText: "Before pasted passage",
      timestampMs: 1000,
      cursorPosition: 21,
      pendingPaste: null,
      forcePaste: true,
    });

    assert.equal(event.event_type, "paste");
    assert.equal(event.inserted_text, "pasted passage");
    assert.equal(event.inserted_origin, "paste");
});

test("uses the bulk-insert fallback when the browser misses paste metadata", () => {
    const insertedText = "External text ".repeat(10);
    const event = createWritingEvent({
      previousText: "",
      nextText: insertedText,
      timestampMs: 1000,
      cursorPosition: insertedText.length,
      pendingPaste: null,
    });

    assert.equal(event.event_type, "paste");
    assert.equal(event.detection_method, "bulk_insert_fallback");
});
