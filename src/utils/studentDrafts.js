export function draftKey(publicToken, userId) {
  return userId
    ? `scribo-account-draft:${encodeURIComponent(userId)}:${publicToken}`
    : `scribo-student-draft:${publicToken}`;
}

export function readStoredDraft(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

export function storeDraft(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStoredDraft(key) {
  try { window.localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
}

export function hasDraftContent(draft) {
  return Boolean(draft && (draft.studentName?.trim() || draft.essayText || draft.eventLog?.length));
}

export function sameDraft(left, right) {
  const content = (draft) => draft ? JSON.stringify([
    draft.studentName, draft.essayHtml, draft.essayText, draft.eventLog,
    draft.pasteEvents, draft.pasteOriginRanges, draft.pauseEvents, draft.startedAt,
  ]) : "";
  return content(left) === content(right);
}

// Each request carries its own revision, so retrying a lost response is safe.
// Only one request runs at a time; edits made in flight remain queued.
export function createDraftSaver({ save, persist, notify, revision = null, initialDraft = null }) {
  let acknowledged = initialDraft;
  let pending = null;
  let inFlight = null;
  let blocked = false;
  let blockedStatus = null;
  let failureError = null;
  let retry = null;
  let stopped = false;
  let timer;

  function schedule(delay = 800) {
    clearTimeout(timer);
    if (!stopped && !blocked) timer = setTimeout(() => { flush().catch(() => {}); }, delay);
  }

  function update(draft) {
    if (stopped || sameDraft(draft, pending?.draft || acknowledged)) return;
    pending = { draft, revision: crypto.randomUUID() };
    if (failureError?.status === 400 || failureError?.status === 413) {
      blocked = false;
      blockedStatus = null;
      retry = null;
    }
    const localSaved = persist({ ...pending, baseRevision: revision, dirty: true });
    notify(blockedStatus ? { ...blockedStatus, localSaved } : { state: "pending", localSaved });
    schedule();
  }

  async function flush() {
    clearTimeout(timer);
    if (inFlight) {
      await inFlight;
      return flush();
    }
    if (stopped || !pending) return revision;
    if (blocked) throw failureError;
    const sending = retry || pending;
    notify({ state: "saving" });
    inFlight = (async () => {
      try {
        const result = await save({ ...sending, baseRevision: revision });
        revision = result.revision;
        retry = null;
        acknowledged = sending.draft;
        if (pending === sending) pending = null;
        const localSaved = persist(pending
          ? { ...pending, baseRevision: revision, dirty: true }
          : { draft: acknowledged, baseRevision: revision, revision, dirty: false });
        notify({ state: pending ? "pending" : "saved", localSaved });
      } catch (error) {
        failureError = error;
        retry = sending;
        blocked = error.status === 409 || error.status === 401 || error.status === 413 || error.status === 400 || error.status === 404;
        const failure = { state: error.status === 409 ? "conflict" : error.status === 401 ? "signed-out" : "error", message: error.message };
        if (blocked) blockedStatus = failure;
        notify(failure);
        if (!blocked) schedule(5000);
        throw error;
      } finally {
        inFlight = null;
      }
    })();
    await inFlight;
    if (pending) return flush();
    return revision;
  }

  return {
    update,
    flush,
    isDirty: () => Boolean(pending || inFlight),
    stop() { stopped = true; clearTimeout(timer); },
  };
}
