// Read-only audit probes. Run from the repository root:
// node docs/writing-replay-reproduction.mjs
// Exit code 1 means at least one replay invariant is violated.
import { createWritingEvent } from "../src/utils/writingAnalytics.js";
import { trimEventLog } from "../src/utils/eventCompression.js";
import { replayUntil } from "../src/utils/replayEngine.js";
import { encodeDraft, decodeDraft } from "../src/utils/draftEncoding.js";

let failures = 0;
let checks = 0;
function check(name, expected, actual, details = {}) {
  checks += 1;
  const pass = expected === actual;
  if (!pass) failures += 1;
  console.log(JSON.stringify({
    name, pass,
    expected: typeof expected === "string" && expected.length > 100
      ? { length: expected.length, prefix: expected.slice(0, 40) } : expected,
    actual: typeof actual === "string" && actual.length > 100
      ? { length: actual.length, prefix: actual.slice(0, 40) } : actual,
    ...details,
  }));
}

function recording() {
  const state = { text: "", events: [] };
  state.record = (nextText, timestampMs, options = {}) => {
    const event = createWritingEvent({
      previousText: state.text, nextText, timestampMs, ...options,
    });
    if (!event) throw new Error("Probe must change the text");
    state.events.push(event);
    state.text = nextText;
  };
  return state;
}

// One text update every 300 ms: 4,000 events at 20 minutes.
const long = recording();
for (let index = 0; index < 5000; index += 1) {
  long.record(long.text + String.fromCharCode(97 + index % 26), (index + 1) * 300);
  if ([3998, 3999, 4000].includes(index)) {
    const saved = trimEventLog(long.events);
    check(`submission boundary: ${long.events.length} events`, long.text,
      replayUntil(saved, Infinity).text, { savedEvents: saved.length });
  }
}
long.record(long.text.slice(0, 1000) + long.text.slice(1010), 1_500_300);
long.record("START " + long.text, 1_500_600);
check("25-minute complete history", long.text, replayUntil(long.events, Infinity).text);
const savedLong = trimEventLog(long.events);
check("25-minute submitted history", long.text, replayUntil(savedLong, Infinity).text,
  { originalEvents: long.events.length, savedEvents: savedLong.length });

// Saving an account draft uses lossless gzip, unlike submission trimming.
const decoded = await decodeDraft(await encodeDraft({ essayText: long.text, eventLog: long.events }));
check("account draft codec preserves full history", JSON.stringify(long.events), JSON.stringify(decoded.eventLog));
check("account draft codec preserves replay", long.text, replayUntil(decoded.eventLog, Infinity).text);

// Large, nonsequential seeks do not mutate or accumulate replay state.
let seeksMatch = true;
for (const timestamp of [1_200_000, 300, 1_500_600, 600_000, 0, 1_500_600]) {
  const expected = timestamp === 1_500_600
    ? long.text
    : Array.from({ length: timestamp / 300 }, (_, index) => String.fromCharCode(97 + index % 26)).join("");
  seeksMatch &&= replayUntil(long.events, timestamp).text === expected;
}
check("repeated forward/backward seeks with full history", true, seeksMatch);

const paste = recording();
paste.record("Hello world", 100);
paste.record("Hello earth", 200, { forcePaste: true });
check("paste replaces selection", paste.text, replayUntil(paste.events, Infinity).text);
paste.record("Hello earth!", 300);
check("typing after a replacement paste", paste.text, replayUntil(paste.events, Infinity).text);

const bulk = recording();
bulk.record("old text", 100);
bulk.record("N".repeat(80), 200);
check("bulk replacement without clipboard metadata", bulk.text, replayUntil(bulk.events, Infinity).text,
  { detectionMethod: bulk.events.at(-1).detection_method });

// Before the correctness fix, partitioning edits changed timestamp ties.
const tied = recording();
for (let index = 0; index < 4001; index += 1) {
  tied.record(index === 4000 ? "" : index % 2 ? "B" : "A", Math.max(100, index * 100));
}
check("equal timestamps before submission", tied.text, replayUntil(tied.events, Infinity).text);
const savedTied = trimEventLog(tied.events);
check("equal timestamps after submission", tied.text, replayUntil(savedTied, Infinity).text,
  { originalEvents: tied.events.length, savedEvents: savedTied.length });
check("all events survive with 4000 non-insert events", tied.events.length, savedTied.length);

// Conditional scenario: device wall clock moves backwards between changes.
const rollback = recording();
rollback.record("a", 100);
rollback.record("ba", 50);
check("backward recording clock preserves edit order", rollback.text, replayUntil(rollback.events, Infinity).text);

console.log(JSON.stringify({ checks, passed: checks - failures, failures }));
process.exitCode = failures ? 1 : 0;
