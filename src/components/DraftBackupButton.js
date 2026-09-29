import { useState } from "react";
import { downloadDraftRecovery } from "../utils/draftRecovery";

export default function DraftBackupButton({ assignment, draft, userId = null, getSaveState }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    setError("");
    try { await downloadDraftRecovery({ assignment, draft, userId, saveState: getSaveState?.() ?? null }); }
    catch { setError("The full backup could not be downloaded. Keep this page open and try again."); }
    finally { setBusy(false); }
  }
  return <span className="draft-backup-control">
    <button className="draft-text-button" type="button" disabled={busy} onClick={download}
      title="Keep your essay, formatting and complete writing history in a recovery file.">
      {busy ? "Preparing backup…" : "Download full backup"}
    </button>
    {error ? <span role="alert">{error}</span> : null}
  </span>;
}
