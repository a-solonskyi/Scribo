import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import {
  createSubmission,
  getAssignmentByPublicToken,
} from "../sites/database";
import { getTextStats } from "../utils/textStats";
import { trimEventLog } from "../utils/eventCompression";
import {
  applyChangeToOriginMap,
  countOriginRanges,
  originMapToRanges,
  originRangesToMap,
  reconstructOriginMap,
} from "../utils/characterOrigins";
import {
  computeSubmissionStats,
  createWritingEvent,
  maybeCreatePause,
} from "../utils/writingAnalytics";
import EssayEditor from "./EssayEditor";
import { ErrorState, LoadingState } from "./LoadingState";

const WRITING_PHRASES = [
  "Verba volant, scripta manent",
  "Nulla dies sine linea",
  "Litera scripta manet",
  "Scribere est cogitare",
  "Nescit vox missa reverti",
  "Qui scribit, bis legit",
  "Calamus gladio fortior",
  "Scripta publica probant",
  "Nota bene",
  "Gesta non verba",
  "Quantum sufficit",
  "Verbatim et literatim",
];

function getDraftKey(publicToken) {
  return `scribo-student-draft:${publicToken}`;
}

function readDraft(publicToken) {
  try {
    const rawDraft = window.localStorage.getItem(getDraftKey(publicToken));
    return rawDraft ? JSON.parse(rawDraft) : null;
  } catch {
    return null;
  }
}

function writeDraft(publicToken, draft) {
  try {
    window.localStorage.setItem(getDraftKey(publicToken), JSON.stringify(draft));
  } catch {
    // Autosave is best-effort; writing should continue if browser storage is full.
  }
}

function clearDraft(publicToken) {
  try {
    window.localStorage.removeItem(getDraftKey(publicToken));
  } catch {
    // Ignore storage errors during cleanup.
  }
}

function createPasteEventId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `paste-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function StudentWritingPage() {
  const { publicToken } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [essayHtml, setEssayHtml] = useState("");
  const [essayText, setEssayText] = useState("");
  const [eventLog, setEventLog] = useState([]);
  const [pasteEvents, setPasteEvents] = useState([]);
  const [pasteOriginRanges, setPasteOriginRanges] = useState([]);
  const [pauseEvents, setPauseEvents] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const draftReadyRef = useRef(false);
  const startedAtRef = useRef(Date.now());
  const previousTextRef = useRef("");
  const lastEventRef = useRef(null);
  const pendingPasteRef = useRef(null);
  const originMapRef = useRef([]);

  const textStats = useMemo(() => getTextStats(essayText), [essayText]);
  const writingPhrase = useMemo(
    () => WRITING_PHRASES[Math.floor(Math.random() * WRITING_PHRASES.length)],
    []
  );

  useEffect(() => {
    async function loadAssignment() {
      setLoading(true);
      setError("");
      draftReadyRef.current = false;
      try {
        setAssignment(await getAssignmentByPublicToken(publicToken));
        const draft = readDraft(publicToken);

        if (draft) {
          setStudentName(draft.studentName || "");
          setEssayHtml(draft.essayHtml || "");
          setEssayText(draft.essayText || "");
          setEventLog(draft.eventLog || []);
          setPasteEvents(draft.pasteEvents || []);
          const restoredOriginMap = draft.pasteOriginRanges
            ? originRangesToMap(
                (draft.essayText || "").length,
                draft.pasteOriginRanges
              )
            : reconstructOriginMap(
                draft.eventLog || [],
                draft.pasteEvents || []
              );
          originMapRef.current = restoredOriginMap;
          setPasteOriginRanges(originMapToRanges(restoredOriginMap));
          setPauseEvents(draft.pauseEvents || []);
          startedAtRef.current = draft.startedAt || Date.now();
          previousTextRef.current = draft.essayText || "";
          lastEventRef.current = (draft.eventLog || []).at(-1) || null;
        } else {
          setStudentName("");
          setEssayHtml("");
          setEssayText("");
          setEventLog([]);
          setPasteEvents([]);
          setPasteOriginRanges([]);
          setPauseEvents([]);
          startedAtRef.current = Date.now();
          previousTextRef.current = "";
          lastEventRef.current = null;
          originMapRef.current = [];
        }
      } catch (err) {
        setError("Assignment link was not found or is no longer available.");
      } finally {
        draftReadyRef.current = true;
        setLoading(false);
      }
    }

    loadAssignment();
  }, [publicToken]);

  useEffect(() => {
    if (!draftReadyRef.current || submitted) return;

    const hasDraftContent =
      studentName.trim() ||
      essayText.trim() ||
      eventLog.length ||
      pasteEvents.length ||
      pauseEvents.length;

    if (!hasDraftContent) return;

    writeDraft(publicToken, {
      publicToken,
      studentName,
      essayHtml,
      essayText,
      eventLog,
      pasteEvents,
      pasteOriginRanges,
      pauseEvents,
      startedAt: startedAtRef.current,
      lastSavedAt: Date.now(),
    });
  }, [
    publicToken,
    studentName,
    essayHtml,
    essayText,
    eventLog,
    pasteEvents,
    pasteOriginRanges,
    pauseEvents,
    submitted,
  ]);

  useEffect(() => {
    function warnBeforeUnload(event) {
      if (submitted || (!essayText.trim() && !studentName.trim())) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [essayText, studentName, submitted]);

  const handleEssayChange = useCallback(({
    html,
    text,
    cursorPosition,
    isPasteTransaction,
  }) => {
    const timestampMs = Date.now() - startedAtRef.current;
    const previousText = previousTextRef.current;
    const event = createWritingEvent({
      previousText,
      nextText: text,
      timestampMs,
      cursorPosition,
      pendingPaste: pendingPasteRef.current,
      forcePaste: isPasteTransaction,
    });

    previousTextRef.current = text;
    setEssayHtml(html);
    setEssayText(text);

    if (!event) return;

    const pause = maybeCreatePause(lastEventRef.current, timestampMs);
    if (pause) setPauseEvents((current) => [...current, pause]);

    let recordedEvent = event;

    if (event.event_type === "paste") {
      const pasteEventId =
        event.paste_event_id ||
        pendingPasteRef.current?.paste_event_id ||
        createPasteEventId();
      const pastedText = event.pasted_text || event.inserted_text || "";
      const pasteEvent = {
        paste_event_id: pasteEventId,
        timestamp_ms: event.timestamp_ms,
        pastedText,
        pasted_text: pastedText,
        character_count: pastedText.length,
        position: event.position,
        detection_method:
          event.detection_method ||
          pendingPasteRef.current?.detection_method ||
          "editor_paste_transaction",
      };

      recordedEvent = {
        ...event,
        paste_event_id: pasteEventId,
      };
      setPasteEvents((current) => {
        if (current.some((item) => item.paste_event_id === pasteEventId)) {
          return current;
        }
        return [...current, pasteEvent];
      });
    }

    originMapRef.current = applyChangeToOriginMap(
      originMapRef.current,
      recordedEvent,
      recordedEvent.event_type === "paste"
    );
    setPasteOriginRanges(originMapToRanges(originMapRef.current));

    lastEventRef.current = recordedEvent;
    setEventLog((current) => [...current, recordedEvent]);
    pendingPasteRef.current = null;
  }, []);

  const handlePaste = useCallback(({
    pastedText,
    characterCount,
    position,
    detectionMethod,
  }) => {
    const timestampMs = Date.now() - startedAtRef.current;
    const existingPending = pendingPasteRef.current;
    if (
      existingPending &&
      Math.abs(existingPending.timestamp_ms - timestampMs) < 1000 &&
      (!pastedText ||
        !existingPending.pastedText ||
        existingPending.pastedText === pastedText)
    ) {
      if (pastedText && !existingPending.pastedText) {
        pendingPasteRef.current = {
          ...existingPending,
          pastedText,
          pasted_text: pastedText,
          character_count: characterCount || pastedText.length,
        };
      }
      return;
    }

    pendingPasteRef.current = {
      paste_event_id: createPasteEventId(),
      timestamp_ms: timestampMs,
      pastedText,
      pasted_text: pastedText,
      character_count: characterCount || pastedText.length,
      position,
      detection_method: detectionMethod || "clipboard_event",
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!studentName.trim()) {
      setError("Enter your name before submitting.");
      return;
    }

    if (!essayText.trim()) {
      setError("Write your essay before submitting.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const compressedEvents = trimEventLog(eventLog);
      const finalPastedCharacters = countOriginRanges(
        pasteOriginRanges,
        essayText.length
      );
      const stats = computeSubmissionStats({
        finalText: essayText,
        eventLog: compressedEvents,
        pasteEvents,
        pauseEvents,
      });

      await createSubmission({
        assignment_id: assignment.id,
        student_name: studentName.trim(),
        title: assignment.topic,
        final_text: essayText,
        stats_json: {
          ...stats,
          finalHtml: essayHtml,
          finalPastedCharacters,
          pasteOriginRanges,
          pasteDetectionVersion: 2,
        },
        event_log_json: compressedEvents,
        paste_events_json: pasteEvents,
      pause_events_json: pauseEvents,
      });

      clearDraft(publicToken);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function downloadSubmittedEssay() {
    const safeTopic = (assignment?.topic || "submitted-essay")
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "submitted-essay";
    const contents = [
      assignment?.topic,
      studentName.trim(),
      "",
      essayText,
    ].filter((value) => value !== undefined && value !== null).join("\n");
    const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeTopic}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) return <LoadingState label="Loading assignment" />;

  if (submitted) {
    return (
      <div className="student-shell narrow">
        <p className="eyebrow">Submitted</p>
        <h1>Essay submitted</h1>
        <p>Your essay and writing-process data have been sent to your professor.</p>
        <button
          className="filled-button submitted-download-button"
          type="button"
          onClick={downloadSubmittedEssay}
        >
          Download my essay
        </button>
      </div>
    );
  }

  return (
    <form className="student-shell" onSubmit={handleSubmit}>
      <p className="student-writing-phrase">"{writingPhrase}"</p>
      <div className="student-header">
        <div>
          <h1>{assignment?.topic}</h1>
          {assignment?.instructions ? <p>{assignment.instructions}</p> : null}
        </div>
        <button className="filled-button student-submit-button" type="submit" disabled={saving}>
          {saving ? "Submitting" : "Submit"}
        </button>
      </div>

      <label className="student-name-field">
        <span>Name</span>
        <input
          value={studentName}
          onChange={(event) => setStudentName(event.target.value)}
          placeholder="Name Surname"
          required
        />
      </label>

      <EssayEditor
        essayHtml={essayHtml}
        onEssayChange={handleEssayChange}
        onPaste={handlePaste}
      />

      <div className="live-counter">
        <span>Words: {textStats.wordCount}</span>
        <span>Characters: {textStats.characterCount}</span>
        <span>Characters without spaces: {textStats.characterCountNoSpaces}</span>
      </div>

      <ErrorState message={error} />
    </form>
  );
}
