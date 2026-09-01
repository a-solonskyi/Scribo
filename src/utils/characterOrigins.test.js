import assert from "node:assert/strict";
import test from "node:test";

import {
  applyChangeToOriginMap,
  getEffectivePasteEvents,
  originMapToRanges,
  reconstructOriginMap,
} from "./characterOrigins.js";

test("typing inside pasted text changes only the inserted characters", () => {
    let origins = [];

    origins = applyChangeToOriginMap(
      origins,
      {
        position: 0,
        insertedText: "pasted text",
        deletedCharacterCount: 0,
      },
      true
    );
    origins = applyChangeToOriginMap(
      origins,
      {
        position: 6,
        insertedText: "NEW",
        deletedCharacterCount: 0,
      },
      false
    );

    assert.deepEqual(originMapToRanges(origins), [
      { start: 0, end: 6 },
      { start: 9, end: 14 },
    ]);
});

test("replacing pasted characters marks only the replacement as typed", () => {
    let origins = Array.from({ length: 10 }, () => true);

    origins = applyChangeToOriginMap(
      origins,
      {
        position: 3,
        insertedText: "XY",
        deletedCharacterCount: 4,
      },
      false
    );

    assert.deepEqual(originMapToRanges(origins), [
      { start: 0, end: 3 },
      { start: 5, end: 8 },
    ]);
});

test("a large legacy insertion is recovered as paste-like activity", () => {
    const insertedText = "A".repeat(200);
    const eventLog = [
      {
        timestamp_ms: 1000,
        event_type: "insert",
        position: 0,
        inserted_text: insertedText,
        deleted_character_count: 0,
      },
    ];

    assert.deepEqual(originMapToRanges(reconstructOriginMap(eventLog, [])), [
      { start: 0, end: 200 },
    ]);
    const events = getEffectivePasteEvents(eventLog, []);
    assert.equal(events.length, 1);
    assert.equal(events[0].character_count, 200);
    assert.equal(events[0].inferred, true);
    assert.equal(events[0].detection_method, "bulk_insert_fallback");
});
