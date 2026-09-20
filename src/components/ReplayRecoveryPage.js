import { useState } from "react";
import { Link } from "react-router-dom";
import { checkReplayRecovery, recoverSubmissionReplay } from "../sites/database";
import { ErrorState } from "./LoadingState";

const labels = {
  complete: "Replay is complete", recoverable: "Saved draft available",
  recovered: "History recovered", unavailable: "No complete saved draft",
  ambiguous: "Multiple drafts match; left unchanged", error: "Could not verify; left unchanged",
};

export default function ReplayRecoveryPage() {
  const [items, setItems] = useState([]);
  const [running, setRunning] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const recoverable = items.filter((item) => item.status === "recoverable");

  async function check() {
    setRunning(true); setError(""); setChecked(false); setItems([]);
    try {
      let cursor = null;
      do {
        const page = await checkReplayRecovery(cursor);
        setItems((current) => [...current, ...page.items]);
        cursor = page.nextCursor;
      } while (cursor);
      setChecked(true);
    } catch (err) { setError(err.message); }
    finally { setRunning(false); }
  }

  async function recover() {
    setRunning(true); setError("");
    try {
      for (const item of recoverable) {
        const result = await recoverSubmissionReplay(item.id);
        setItems((current) => current.map((row) => row.id === item.id ? { ...row, status: result.status } : row));
      }
    } catch (err) { setError(err.message); }
    finally { setRunning(false); }
  }

  return <section className="page-section">
    <Link className="text-button" to="/dashboard">Back to classes</Link>
    <h1>Check saved writing replays</h1>
    <p>Check your submissions for incomplete writing history. Recovery uses a saved draft only when it matches the submitted essay exactly. Each repair keeps a backup of the original history.</p>
    <div className="recovery-actions">
      <button className="secondary-button" disabled={running} onClick={check}>{running ? "Working…" : "Check my submissions"}</button>
      {checked && recoverable.length > 0 ? <button className="filled-button" disabled={running} onClick={recover}>Recover {recoverable.length} verified {recoverable.length === 1 ? "replay" : "replays"}</button> : null}
    </div>
    <ErrorState message={error} />
    <p role="status">{items.length ? `${items.length} checked · ${items.filter((item) => item.status === "complete").length} complete · ${recoverable.length} recoverable · ${items.filter((item) => item.status === "recovered").length} recovered · ${items.filter((item) => ["unavailable", "ambiguous", "error"].includes(item.status)).length} unresolved` : checked ? "No submissions found." : ""}</p>
    {checked && items.some((item) => item.status === "unavailable") ? <p>Some missing history has no complete saved draft. Those essays remain available, but their missing writing events cannot be recreated.</p> : null}
    {items.length > 0 ? <ul className="recovery-list">{items.map((item) => <li key={item.id}>
      <Link to={`/submission/${item.id}`}>{item.studentName}</Link><span>{labels[item.status] || item.status}</span>
    </li>)}</ul> : null}
  </section>;
}
