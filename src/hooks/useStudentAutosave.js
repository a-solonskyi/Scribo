import { useEffect, useRef, useState } from "react";
import { saveStudentDraft } from "../sites/database";
import { createDraftSaver, draftKey, hasDraftContent, removeStoredDraft, storeDraft } from "../utils/studentDrafts";

export default function useStudentAutosave({ publicToken, account, draft, submitted, transferGuest }) {
  const [status, setStatus] = useState({ state: account ? account.draft ? "saved" : "ready" : "local", localSaved: true });
  const saverRef = useRef(null);
  const localSavedRef = useRef(true);
  const hasSavedRef = useRef(hasDraftContent(draft));
  const key = draftKey(publicToken, account?.user.id);

  useEffect(() => {
    if (!account || submitted) return;
    const saver = createDraftSaver({
      revision: account.revision,
      initialDraft: account.draft,
      save: (payload) => saveStudentDraft(publicToken, { ...payload, expectedUserId: account.user.id }),
      persist: (value) => storeDraft(key, value),
      notify: (next) => {
        setStatus((current) => ({ ...current, ...next }));
        if (next.state === "saved" && transferGuest) {
          removeStoredDraft(draftKey(publicToken));
          try { window.sessionStorage.removeItem(`scribo-transfer:${publicToken}`); } catch { /* Optional transfer marker. */ }
        }
      },
    });
    saverRef.current = saver;
    const flush = () => { saver.flush().catch(() => {}); };
    const onHidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("online", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      saver.stop();
      window.removeEventListener("online", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [account, publicToken, key, submitted, transferGuest]);

  useEffect(() => {
    if (submitted || (!hasDraftContent(draft) && !account?.draft && !hasSavedRef.current)) return;
    hasSavedRef.current = true;
    if (account) saverRef.current?.update(draft);
    else {
      const saved = storeDraft(key, { ...draft, lastSavedAt: Date.now() });
      localSavedRef.current = saved;
      // Reflect the external storage result only when its availability changes.
      // oxlint-disable-next-line react/react-compiler
      setStatus((current) => current.localSaved === saved ? current : { state: saved ? "local" : "error", localSaved: saved });
    }
  }, [draft, account, key, submitted]);

  let message;
  if (!account) message = status.localSaved ? "Guest · Saved in this browser only" : "Browser storage is unavailable. Download a copy before leaving.";
  else if (status.state === "saved") message = "Saved to your account";
  else if (status.state === "ready") message = "Your progress will save automatically as you write";
  else if (status.state === "pending" || status.state === "saving") message = "Saving to your account…";
  else if (status.state === "conflict" || status.state === "signed-out") message = status.message || "A newer draft is saved elsewhere. Download your edits, then reload to choose a draft.";
  else message = `Not saved online yet. ${status.message || "Check your connection; we’ll retry automatically."}`;
  if (account && !status.localSaved && status.state !== "saved") message += " Browser backup is also unavailable. Keep this page open or download a copy.";

  return {
    status, message,
    flush: () => saverRef.current?.flush(),
    stop: () => saverRef.current?.stop(),
    isDirty: () => account ? saverRef.current?.isDirty() : !localSavedRef.current,
  };
}
