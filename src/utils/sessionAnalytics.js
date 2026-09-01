export const DEFAULT_PAUSE_THRESHOLD_MS = 5000;
export const DEFAULT_BUCKET_MS = 10000;

function createSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `essay-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptySession(now = Date.now()) {
  return {
    sessionId: createSessionId(),
    status: "active",
    sessionStartedAt: now,
    startedAt: now,
    lastEditedAt: null,
    completedAt: null,
    firstKeystrokeAt: null,
    lastKeystrokeAt: null,
    deletedCharacters: 0,
    insertedSpaces: 0,
    pasteEvents: [],
    activityEvents: [],
  };
}

export function recordWritingEvent(session, event) {
  const timestamp = event.timestamp || Date.now();
  const firstKeystrokeAt = session.firstKeystrokeAt || timestamp;

  return {
    ...session,
    firstKeystrokeAt,
    lastKeystrokeAt: timestamp,
    lastEditedAt: timestamp,
    deletedCharacters:
      session.deletedCharacters + Math.max(0, event.deletedCharacters || 0),
    insertedSpaces:
      (session.insertedSpaces || 0) + Math.max(0, event.insertedSpaces || 0),
    activityEvents: [
      ...session.activityEvents,
      {
        timestamp,
        charactersChanged: Math.max(1, event.charactersChanged || 1),
        insertedCharacters: Math.max(0, event.insertedCharacters || 0),
        deletedCharacters: Math.max(0, event.deletedCharacters || 0),
        insertedSpaces: Math.max(0, event.insertedSpaces || 0),
        wordCount:
          typeof event.wordCount === "number"
            ? Math.max(0, event.wordCount)
            : undefined,
        paragraphIndex:
          typeof event.paragraphIndex === "number"
            ? Math.max(0, event.paragraphIndex)
            : undefined,
      },
    ],
  };
}

export function recordPasteEvent(session, pasteLength, timestamp = Date.now()) {
  return {
    ...session,
    lastEditedAt: timestamp,
    pasteEvents: [
      ...session.pasteEvents,
      {
        timestamp,
        characterCount: pasteLength,
      },
    ],
  };
}

export function getSessionAnalytics({
  session,
  textStats,
  now = Date.now(),
  pauseThresholdMs = DEFAULT_PAUSE_THRESHOLD_MS,
  bucketMs = DEFAULT_BUCKET_MS,
}) {
  if (!session) {
    return {
      firstKeystrokeAt: null,
      lastKeystrokeAt: null,
      sessionDurationMs: 0,
      writingWindowMs: 0,
      activeWritingTimeMs: 0,
      totalPauseMs: 0,
      pauses: [],
      longestPauseMs: 0,
      deletedCharacters: 0,
      insertedSpaces: 0,
      revisionRatio: 0,
      pasteSummary: getPasteSummary([]),
      pasteEvents: [],
      timeline: [],
      typingBursts: [],
      wordsPerMinute: 0,
    };
  }

  const events = [...(session.activityEvents || [])].sort(
    (a, b) => a.timestamp - b.timestamp
  );
  const firstKeystrokeAt = session.firstKeystrokeAt;
  const lastKeystrokeAt = session.lastKeystrokeAt;
  const writingWindowMs =
    firstKeystrokeAt && lastKeystrokeAt
      ? Math.max(0, lastKeystrokeAt - firstKeystrokeAt)
      : 0;
  const pauses = getPauses(events, pauseThresholdMs);
  const totalPauseMs = pauses.reduce((sum, pause) => sum + pause.durationMs, 0);
  const activeWritingTimeMs = Math.max(0, writingWindowMs - totalPauseMs);
  const sessionDurationMs = Math.max(0, now - session.sessionStartedAt);
  const finalCharacters = textStats.characterCount;
  const revisionRatio =
    finalCharacters > 0 ? session.deletedCharacters / finalCharacters : 0;
  const pasteSummary = getPasteSummary(session.pasteEvents || []);
  const timeline = getActivityTimeline(events, firstKeystrokeAt, bucketMs);
  const typingBursts = getTypingBursts(events, pauseThresholdMs);
  const wordsPerMinute =
    activeWritingTimeMs > 0
      ? textStats.wordCount / (activeWritingTimeMs / 60000)
      : 0;

  return {
    firstKeystrokeAt,
    lastKeystrokeAt,
    sessionDurationMs,
    writingWindowMs,
    activeWritingTimeMs,
    totalPauseMs,
    pauses,
    longestPauseMs: pauses.reduce(
      (max, pause) => Math.max(max, pause.durationMs),
      0
    ),
    deletedCharacters: session.deletedCharacters,
    insertedSpaces: session.insertedSpaces || 0,
    revisionRatio,
    pasteSummary,
    pasteEvents: session.pasteEvents || [],
    timeline,
    typingBursts,
    wordsPerMinute,
  };
}

export function getPauses(events, thresholdMs) {
  const pauses = [];

  for (let index = 1; index < events.length; index += 1) {
    const previous = events[index - 1];
    const current = events[index];
    const gap = current.timestamp - previous.timestamp;

    if (gap >= thresholdMs) {
      pauses.push({
        start: previous.timestamp,
        end: current.timestamp,
        durationMs: gap,
      });
    }
  }

  return pauses;
}

export function getTypingBursts(events, pauseThresholdMs) {
  if (!events.length) return [];

  const bursts = [];
  let current = {
    start: events[0].timestamp,
    end: events[0].timestamp,
    eventCount: 1,
    charactersChanged: events[0].charactersChanged,
  };

  for (let index = 1; index < events.length; index += 1) {
    const event = events[index];
    const previous = events[index - 1];

    if (event.timestamp - previous.timestamp >= pauseThresholdMs) {
      bursts.push(current);
      current = {
        start: event.timestamp,
        end: event.timestamp,
        eventCount: 1,
        charactersChanged: event.charactersChanged,
      };
    } else {
      current.end = event.timestamp;
      current.eventCount += 1;
      current.charactersChanged += event.charactersChanged;
    }
  }

  bursts.push(current);
  return bursts;
}

export function getActivityTimeline(events, firstKeystrokeAt, bucketMs) {
  if (!events.length || !firstKeystrokeAt) return [];

  const buckets = new Map();

  for (const event of events) {
    const bucketIndex = Math.floor((event.timestamp - firstKeystrokeAt) / bucketMs);
    const bucketStart = firstKeystrokeAt + bucketIndex * bucketMs;
    const current = buckets.get(bucketIndex) || {
      index: bucketIndex,
      start: bucketStart,
      end: bucketStart + bucketMs,
      eventCount: 0,
      charactersChanged: 0,
      insertedCharacters: 0,
      deletedCharacters: 0,
    };

    current.eventCount += 1;
    current.charactersChanged += event.charactersChanged || 0;
    current.insertedCharacters += event.insertedCharacters || 0;
    current.deletedCharacters += event.deletedCharacters || 0;
    buckets.set(bucketIndex, current);
  }

  return [...buckets.values()].sort((a, b) => a.index - b.index);
}

export function getPasteSummary(pasteEvents) {
  const count = pasteEvents.length;
  const totalCharacters = pasteEvents.reduce(
    (sum, event) => sum + event.characterCount,
    0
  );
  const largestPaste = pasteEvents.reduce(
    (max, event) => Math.max(max, event.characterCount),
    0
  );

  return {
    count,
    totalCharacters,
    largestPaste,
  };
}

export function formatDuration(ms) {
  if (!ms || ms < 0) return "0s";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatClock(timestamp) {
  if (!timestamp) return "Not yet";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(timestamp));
}
