import test from "node:test";
import assert from "node:assert/strict";
import { createReplayIndex, replayUntil } from "./replayEngine.js";
import { createWritingEvent } from "./writingAnalytics.js";
import { originRangesToMap, reconstructOriginMap } from "./characterOrigins.js";
import { createPlaybackClock } from "./playbackClock.js";

test("checkpoint seeks match full reconstruction and paste origins across mixed edits", () => {
  let seed = 17;
  const random = (max) => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % max; };
  let text = "";
  const events = [];
  for (let i = 0; i < 1500; i++) {
    const at = random(text.length + 1);
    const deleted = Math.min(random(4), text.length - at);
    const inserted = ["a", "b", "📚", "\n\n", "XYZ"][random(5)];
    const next = text.slice(0, at) + inserted + text.slice(at + deleted);
    const event = createWritingEvent({ previousText: text, nextText: next, timestampMs: i * 300, forcePaste: i % 9 === 0 });
    if (event) events.push({ ...event, sequence: events.length });
    text = next;
  }
  const index = createReplayIndex(events);
  assert.ok(index.checkpointCount <= 66);
  assert.ok(index.maxEventsPerSeek < events.length / 10);
  for (const count of [events.length, 0, 1, 63, 64, 65, ...Array.from({ length: 50 }, () => random(events.length))]) {
    const time = count ? events[count - 1].timestamp_ms : -1;
    const result = index.seek(time);
    assert.equal(result.text, replayUntil(events, time).text);
    assert.equal(result.eventCount, count);
    assert.deepEqual(originRangesToMap(result.text.length, result.originRanges), reconstructOriginMap(events.slice(0, count)));
  }
});

test("a stable monotonic playback anchor handles long stalls, speed changes, pause and seeking", () => {
  let now = 0;
  const clock = createPlaybackClock({ durationMs: 2_000_000, now: () => now });
  clock.setSpeed(5); clock.play();
  now = 120; assert.equal(clock.read(), 600);
  now = 20_000; assert.equal(clock.read(), 100_000);
  clock.setSpeed(2);
  now += 1000; assert.equal(clock.read(), 102_000);
  clock.pause(); now += 50_000; assert.equal(clock.read(), 102_000);
  clock.seek(300); clock.play(); now += 100; assert.equal(clock.read(), 500);
  clock.seek(0); now += 500; assert.equal(clock.read(), 1000);
  now += 2_000_000; assert.equal(clock.read(), 2_000_000);
});
