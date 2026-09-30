import { useEffect, useRef, useState } from 'react';
import { getSubmissionGrade, saveSubmissionGrade } from '../sites/database';
import { validateScore } from '../utils/grading';
import GradeDialog from './GradeDialog';
import { ErrorState } from './LoadingState';

export default function SubmissionGrade({ submissionId, disabled }) {
  const [grade, setGrade] = useState(null),
    [open, setOpen] = useState(false),
    [value, setValue] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [conflict, setConflict] = useState(false);
  const attempt = useRef(null);
  useEffect(() => {
    let active = true;
    getSubmissionGrade(submissionId)
      .then((data) => {
        if (active) setGrade(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [submissionId]);
  async function reload() {
    setBusy(true);
    setError('');
    try {
      setGrade(await getSubmissionGrade(submissionId));
      setConflict(false);
      attempt.current = null;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save(event) {
    event.preventDefault();
    if (busy || !grade || value === '') return;
    setError('');
    try {
      const score = validateScore(Number(value), grade.effective_max_grade);
      const signature = `${score}:${grade.revision}`;
      if (attempt.current?.signature !== signature)
        attempt.current = { signature, request_id: crypto.randomUUID() };
      setBusy(true);
      const saved = await saveSubmissionGrade(submissionId, {
        score,
        base_revision: grade.revision,
        request_id: attempt.current.request_id,
      });
      setGrade(saved);
      setOpen(false);
      attempt.current = null;
      setConflict(false);
    } catch (e) {
      setError(e.message);
      setConflict(e.status === 409);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="submission-grade-control">
      {grade?.score !== null && grade?.score !== undefined ? (
        <span className="saved-grade" aria-live="polite">
          Grade:{' '}
          <strong>
            {grade.score} / {grade.effective_max_grade}
          </strong>
        </span>
      ) : null}
      <button
        className="filled-button"
        type="button"
        disabled={disabled || busy || !grade}
        onClick={() => {
          setValue(grade.score === null ? '' : String(grade.score));
          setOpen(true);
          setError('');
        }}
      >
        {grade?.score === null || !grade ? 'Submit grade' : 'Update grade'}
      </button>
      {!grade && error ? (
        <>
          <ErrorState message={error} />
          <button type="button" onClick={reload}>
            Retry grade loading
          </button>
        </>
      ) : null}
      {open ? (
        <GradeDialog
          className="grade-dialog"
          labelledBy="grade-dialog-title"
          busy={busy}
          onClose={() => setOpen(false)}
        >
          <div className="page-header compact">
            <h2 id="grade-dialog-title">Submit grade</h2>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
          <form className="stack-form" onSubmit={save}>
            <label>
              <span>Grade (out of {grade.effective_max_grade})</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max={grade.effective_max_grade}
                step="0.01"
                required
                value={value}
                disabled={busy}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
            <p className="muted-line">
              {grade.max_grade === null
                ? 'No maximum was set for this essay. Grades use a 0–100 scale.'
                : `The maximum score for this essay is ${grade.max_grade}.`}
            </p>
            <ErrorState message={error} />
            {conflict ? (
              <button type="button" onClick={reload} disabled={busy}>
                Reload saved grade
              </button>
            ) : null}
            {conflict && grade.score !== null ? (
              <p className="muted-line">
                Your entered score is retained for review.
              </p>
            ) : null}
            <button
              className="filled-button"
              type="submit"
              disabled={busy || conflict || value === ''}
            >
              {busy ? 'Saving…' : 'Submit grade'}
            </button>
          </form>
        </GradeDialog>
      ) : null}
    </div>
  );
}
