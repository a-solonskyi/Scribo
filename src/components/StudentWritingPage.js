import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { getStudentDraft } from "../sites/database";
import { draftKey, hasDraftContent, readStoredDraft, removeStoredDraft, sameDraft, storeDraft } from "../utils/studentDrafts";
import useStudentAutosave from "../hooks/useStudentAutosave";

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

const guestExplanation = "Your draft is saved automatically after each change in this browser’s local storage on this device. It usually survives closing the tab or restarting the browser. It can be lost if you clear this site’s data, use private browsing, change browser or device, or your browser removes stored data.";

function signInPath(publicToken) {
  return `/signin-with-chatgpt?return_to=${encodeURIComponent(`/write/${publicToken}`)}`;
}

function prepareGuestTransfer(publicToken) {
  try { window.sessionStorage.setItem(`scribo-transfer:${publicToken}`, "yes"); } catch { /* Guest copy remains available. */ }
}

export default function StudentWritingPage() {
  const { publicToken } = useParams();
  return <StudentDraftLoader key={publicToken} publicToken={publicToken} />;
}

function StudentDraftLoader({ publicToken }) {
  const [loaded, setLoaded] = useState(null);
  const [failure, setFailure] = useState("");
  const [choice, setChoice] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAssignmentByPublicToken(publicToken), getStudentDraft(publicToken)])
      .then(([assignment, account]) => {
        if (cancelled) return;
        const guest = readStoredDraft(draftKey(publicToken));
        const backup = account.user ? readStoredDraft(draftKey(publicToken, account.user.id)) : null;
        let transfer = false;
        try { transfer = window.sessionStorage.getItem(`scribo-transfer:${publicToken}`) === "yes"; } catch { /* Optional transfer marker. */ }
        const local = account.user
          ? (transfer && hasDraftContent(guest) ? guest : backup?.dirty ? backup.draft : null)
          : guest;
        const conflict = account.user && local && account.draft && !sameDraft(local, account.draft)
          && (account.submitted || transfer || (backup?.baseRevision !== account.revision && backup?.revision !== account.revision));
        setLoaded({ assignment, account, local, transfer, conflict });
        if (account.user && !conflict) setChoice({ draft: local || account.draft, mode: "account" });
      }).catch((error) => {
        if (!cancelled) setFailure(error.status === 404 ? "Assignment link was not found or is no longer available." : "We couldn’t load your saved progress. Check your connection and try again; your browser draft has not been changed.");
      });
    return () => { cancelled = true; };
  }, [publicToken, attempt]);

  if (failure) return <div className="student-shell narrow"><ErrorState message={failure} /><button className="filled-button" onClick={() => { setFailure(""); setAttempt((value) => value + 1); }}>Try again</button></div>;
  if (!loaded) return <LoadingState label="Loading assignment and saved progress" />;
  const { assignment, account, local, conflict, transfer } = loaded;
  function useAccountDraft() {
    storeDraft(draftKey(publicToken, account.user.id), { draft: account.draft, revision: account.revision, baseRevision: account.revision, dirty: false });
    try { window.sessionStorage.removeItem(`scribo-transfer:${publicToken}`); } catch { /* Guest copy is retained. */ }
    setChoice({ draft: account.draft, mode: "account" });
  }
  if (choice) return <StudentWritingSession
    publicToken={publicToken}
    assignment={assignment}
    initialDraft={choice.draft}
    account={choice.mode === "account" ? account : null}
    transferGuest={transfer && choice.draft === local}
  />;

  return (
    <main className="student-shell narrow student-entry">
      <p className="eyebrow">Skribo Essay</p>
      <h1>{assignment.topic}</h1>
      {assignment.instructions ? <p className="student-entry-instructions">{assignment.instructions}</p> : null}
      <h2>{conflict ? "Choose the draft to continue" : "How would you like to save your progress?"}</h2>
      {conflict ? <>
        <p>There is a different draft in your account and in this browser. Choose one to continue. Download the browser copy first if you need to keep both.</p>
        <button className="draft-text-button" onClick={() => downloadEssay(assignment, local)}>Download browser copy</button>
        <div className="student-entry-options">
          <section className="student-entry-option">
            <h3>Saved in your account</h3>
            <p>{account.submitted ? "This essay has already been submitted." : "The draft last saved to your account for this essay."}</p>
            <p className="draft-preview">{account.draft?.essayText?.slice(0, 200) || "No essay text yet."}</p>
            <button className="filled-button" onClick={useAccountDraft}>Use account draft</button>
          </section>
          {!account.submitted ? <section className="student-entry-option">
            <h3>From this browser</h3>
            <p>Continue this copy and save it to your account, replacing the account draft.</p>
            <p className="draft-preview">{local?.essayText?.slice(0, 200) || "No essay text yet."}</p>
            <button className="secondary-button" onClick={() => setChoice({ draft: local, mode: "account" })}>Use browser draft</button>
          </section> : null}
        </div>
      </> : <>
        <div className="student-entry-options">
          <section className="student-entry-option">
            <h3>Save to your account</h3>
            <p>Sign in with ChatGPT to save this essay’s progress online. Open this same essay link and sign in with the same account to continue on another device.</p>
            <a className="filled-button student-signin" href={signInPath(publicToken)} target="_top" onClick={() => prepareGuestTransfer(publicToken)}>Sign in with ChatGPT</a>
          </section>
          <section className="student-entry-option">
            <h3>Continue as a guest</h3>
            <p>{guestExplanation}</p>
            <button className="secondary-button" onClick={() => setChoice({ draft: local, mode: "guest" })}>{hasDraftContent(local) ? "Continue guest draft" : "Continue as a guest"}</button>
          </section>
        </div>
        <p className="student-storage-note">Skribo uses your ChatGPT identity to connect you to your saved essay. Your draft and writing history are stored by Skribo. Your professor receives the essay and writing-process data when you submit.</p>
      </>}
    </main>
  );
}

function downloadEssay(assignment, draft) {
  const safeTopic = (assignment?.topic || "essay").trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase() || "essay";
  const contents = [assignment?.topic, draft?.studentName, "", draft?.essayText].filter((value) => value !== undefined && value !== null).join("\n");
  const url = URL.createObjectURL(new Blob([contents], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeTopic}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createPasteEventId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `paste-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function StudentWritingSession({ publicToken, assignment, initialDraft, account, transferGuest }) {
  const [studentName, setStudentName] = useState(initialDraft?.studentName || "");
  const [essayHtml, setEssayHtml] = useState(initialDraft?.essayHtml || "");
  const [essayText, setEssayText] = useState(initialDraft?.essayText || "");
  const [eventLog, setEventLog] = useState(initialDraft?.eventLog || []);
  const [pasteEvents, setPasteEvents] = useState(initialDraft?.pasteEvents || []);
  const [pasteOriginRanges, setPasteOriginRanges] = useState(() => initialDraft?.pasteOriginRanges || originMapToRanges(reconstructOriginMap(initialDraft?.eventLog || [], initialDraft?.pasteEvents || [])));
  const [pauseEvents, setPauseEvents] = useState(initialDraft?.pauseEvents || []);
  const [submitted, setSubmitted] = useState(account?.submitted || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [startedAt] = useState(() => initialDraft?.startedAt || Date.now());
  const previousTextRef = useRef(initialDraft?.essayText || "");
  const lastEventRef = useRef((initialDraft?.eventLog || []).at(-1) || null);
  const pendingPasteRef = useRef(null);
  const originMapRef = useRef(originRangesToMap((initialDraft?.essayText || "").length, pasteOriginRanges));
  const allowNavigationRef = useRef(false);
  const textStats = useMemo(() => getTextStats(essayText), [essayText]);
  const draft = useMemo(() => ({
    publicToken, studentName, essayHtml, essayText, eventLog, pasteEvents,
    pasteOriginRanges, pauseEvents, startedAt,
  }), [publicToken, studentName, essayHtml, essayText, eventLog, pasteEvents, pasteOriginRanges, pauseEvents, startedAt]);
  const autosave = useStudentAutosave({ publicToken, account, draft, submitted, transferGuest });

  useEffect(() => {
    function warnBeforeUnload(event) {
      if (submitted || allowNavigationRef.current || !autosave.isDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [submitted, autosave]);

  const handleEssayChange = useCallback(({
    html,
    text,
    cursorPosition,
    isPasteTransaction,
  }) => {
    const timestampMs = Date.now() - startedAt;
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
  }, [startedAt]);

  const handlePaste = useCallback(({
    pastedText,
    characterCount,
    position,
    detectionMethod,
  }) => {
    const timestampMs = Date.now() - startedAt;
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
  }, [startedAt]);

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
      const draftRevision = account ? await autosave.flush() : null;
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
        ...(account ? { student_draft_revision: draftRevision, expected_user_id: account.user.id } : {}),
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

      autosave.stop();
      removeStoredDraft(draftKey(publicToken, account?.user.id));
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <div className="student-shell narrow">
        <p className="eyebrow">Submitted</p>
        <h1>Essay submitted</h1>
        <p>Your essay and writing-process data have been sent to your professor.</p>
        <button
          className="filled-button submitted-download-button"
          type="button"
          onClick={() => downloadEssay(assignment, draft)}
        >
          Download my essay
        </button>
      </div>
    );
  }

  return (
    <form className="student-shell" onSubmit={handleSubmit}>
      <div className="student-header">
        <div>
          <h1>{assignment?.topic}</h1>
          {assignment?.instructions ? <p>{assignment.instructions}</p> : null}
        </div>
        <button className="filled-button student-submit-button" type="submit" disabled={saving}>
          {saving ? "Submitting" : "Submit"}
        </button>
      </div>

      <div className="student-save-bar">
        <div>
          <output className="student-save-status" aria-live="polite">{autosave.message}</output>
          {account ? <p className="student-storage-note">{account.user.displayName} · Progress is saved for this essay.</p> : null}
        </div>
        <div className="student-save-actions">
          <button className="draft-text-button" type="button" onClick={() => downloadEssay(assignment, draft)}>Download a copy</button>
          {account ? <a className="draft-text-button" href={`/signout-with-chatgpt?return_to=${encodeURIComponent(`/write/${publicToken}`)}`} target="_top" onClick={async (event) => {
            event.preventDefault();
            const href = event.currentTarget.href;
            try {
              await autosave.flush();
              allowNavigationRef.current = true;
              window.top.location.assign(href);
            } catch {
              setError("Your latest edits haven’t saved online. Download a copy before signing out, or wait for saving to finish.");
            }
          }}>Sign out</a> : null}
          {!account || autosave.status.state === "signed-out" ? <a className="draft-text-button" href={signInPath(publicToken)} target="_top" onClick={(event) => {
            if (!autosave.status.localSaved) {
              event.preventDefault();
              setError("Browser storage is unavailable. Download a copy before signing in so your current text is safe.");
              return;
            }
            if (!account) prepareGuestTransfer(publicToken);
            allowNavigationRef.current = true;
          }}>Sign in with ChatGPT</a> : null}
          {autosave.status.state === "conflict" ? <button className="draft-text-button" type="button" onClick={() => window.location.reload()}>Reload saved drafts</button> : null}
          {autosave.status.state === "error" ? <button className="draft-text-button" type="button" onClick={() => autosave.flush().catch(() => {})}>Retry saving</button> : null}
        </div>
      </div>
      {!account ? <details className="student-storage-details"><summary>Where is my guest draft saved?</summary><p>{guestExplanation} Download a copy for safekeeping, or sign in to save this draft to your account.</p></details> : null}

      <fieldset className="student-writing-fields" disabled={saving}>
      <label className="student-name-field">
        <span>Name</span>
        <input
          value={studentName}
          onChange={(event) => setStudentName(event.target.value)}
          placeholder="Name Surname"
          maxLength={180}
          required
        />
      </label>

      <EssayEditor
        essayHtml={essayHtml}
        onEssayChange={handleEssayChange}
        onPaste={handlePaste}
        editable={!saving}
      />

      <div className="live-counter">
        <span>Words: {textStats.wordCount}</span>
        <span>Characters: {textStats.characterCount}</span>
        <span>Characters without spaces: {textStats.characterCountNoSpaces}</span>
      </div>

      </fieldset>
      <ErrorState message={error} />
    </form>
  );
}
