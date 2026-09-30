import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, X } from 'lucide-react';
import { getAssignmentGrades, exportMoodleGrades } from '../sites/database';
import { buildMoodleCsv, sortGradeRows } from '../utils/grading';
import GradeDialog from './GradeDialog';
import { ErrorState, LoadingState } from './LoadingState';
const COLUMNS = [
  ['name', 'Name'],
  ['surname', 'Surname'],
  ['score', 'Grade'],
  ['pasted_percent', '% of pasted characters'],
  ['on_time', 'Complete on time'],
];

function MoodleExport({ assignment, data, onClose, onExported }) {
  const graded = data.rows.filter((r) => r.score !== null);
  const [emails, setEmails] = useState(() =>
    Object.fromEntries(graded.map((r) => [r.id, r.email])),
  );
  const [selected, setSelected] = useState(
    () => new Set(graded.map((r) => r.id)),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function download(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    const rows = graded.filter((r) => selected.has(r.id));
    try {
      buildMoodleCsv(
        rows.map((r) => ({ email: emails[r.id], score: r.score })),
      );
      setBusy(true);
      const blob = await exportMoodleGrades(
        assignment.id,
        rows.map((r) => ({
          submission_id: r.id,
          revision: r.revision,
          email: emails[r.id],
        })),
      );
      const url = URL.createObjectURL(blob),
        link = document.createElement('a');
      link.href = url;
      link.download = 'moodle-grades.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onExported(
        Object.fromEntries(rows.map((r) => [r.id, emails[r.id].trim()])),
      );
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <GradeDialog
      className="moodle-dialog"
      labelledBy="moodle-title"
      busy={busy}
      onClose={onClose}
    >
      <div className="page-header compact">
        <h2 id="moodle-title">Moodle export</h2>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <p>
        Review the students’ Moodle email addresses and fill in any missing
        addresses. The CSV contains only <strong>Email address</strong> and{' '}
        <strong>Grade</strong>. Ungraded submissions are omitted.
      </p>
      <p className="muted-line">
        Email mappings are saved for this essay. Select one submission per
        student.
      </p>
      <form onSubmit={download}>
        <div className="moodle-mappings">
          {graded.map((row) => (
            <div className="moodle-mapping" key={row.id}>
              <label className="moodle-select">
                <input
                  type="checkbox"
                  checked={selected.has(row.id)}
                  disabled={busy}
                  aria-label={`Include ${row.full_name}`}
                  onChange={(e) =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (e.target.checked) next.add(row.id);
                      else next.delete(row.id);
                      return next;
                    })
                  }
                />
                <span>
                  {row.full_name}
                  <small>
                    Grade: {row.score} / {data.effective_max_grade}
                  </small>
                </span>
              </label>
              <label>
                <span className="sr-only">
                  Moodle email for {row.full_name}
                </span>
                <input
                  type="email"
                  autoComplete="off"
                  placeholder="student@example.edu"
                  value={emails[row.id] || ''}
                  required={selected.has(row.id)}
                  disabled={busy || !selected.has(row.id)}
                  onChange={(e) =>
                    setEmails({ ...emails, [row.id]: e.target.value })
                  }
                />
              </label>
            </div>
          ))}
        </div>
        <details className="moodle-help">
          <summary>Import this file into Moodle</summary>
          <p>
            In your course gradebook, choose Import → CSV. Use UTF-8 and a comma
            separator. Map “Email address” to “useremail”, and “Grade” to the
            intended grade item. Set its maximum grade to{' '}
            {data.effective_max_grade}. Check the preview before confirming the
            import.
          </p>
          <a
            href="https://docs.moodle.org/402/en/Grade_import"
            target="_blank"
            rel="noreferrer"
          >
            Moodle import instructions
          </a>
        </details>
        <ErrorState message={error} />
        <button
          type="submit"
          className="filled-button"
          disabled={busy || !selected.size}
        >
          {busy ? 'Preparing…' : 'Download CSV'}
        </button>
      </form>
    </GradeDialog>
  );
}
export default function GradesView({ assignment }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [reload, setReload] = useState(0);
  const [sort, setSort] = useState({ key: 'surname', direction: 'asc' }),
    [exportOpen, setExportOpen] = useState(false);
  useEffect(() => {
    let active = true;
    getAssignmentGrades(assignment.id)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [assignment.id, reload]);
  const rows = useMemo(
    () => sortGradeRows(data?.rows || [], sort.key, sort.direction),
    [data, sort],
  );
  function refresh() {
    setError('');
    setData(null);
    setReload((current) => current + 1);
  }
  function changeSort(key) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }
  if (error)
    return (
      <>
        <ErrorState message={error} />
        <button type="button" onClick={refresh}>
          Retry loading grades
        </button>
      </>
    );
  if (!data) return <LoadingState label="Loading grades" />;
  return (
    <section className="grades-view" aria-label="Essay grades">
      <div className="grades-actions">
        <p className="muted-line">
          {rows.filter((r) => r.score !== null).length} of {rows.length} graded
          · Maximum: {data.effective_max_grade}
          {data.max_grade === null ? ' (default)' : ''}
        </p>
        <div>
          <button type="button" className="text-button" onClick={refresh}>
            Refresh
          </button>
          <button
            type="button"
            className="filled-button"
            disabled={!rows.some((r) => r.score !== null)}
            onClick={() => setExportOpen(true)}
          >
            Moodle export
          </button>
        </div>
      </div>
      <div className="grades-table-scroll">
        <table className="grades-table">
          <thead>
            <tr>
              {COLUMNS.map(([key, label]) => (
                <th
                  key={key}
                  scope="col"
                  aria-sort={
                    sort.key === key
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    onClick={() => changeSort(key)}
                    aria-label={`Sort by ${label}`}
                  >
                    <span>{label}</span>
                    {sort.key !== key ? (
                      <ArrowUpDown />
                    ) : sort.direction === 'asc' ? (
                      <ArrowUp />
                    ) : (
                      <ArrowDown />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link
                    to={`/submission/${row.id}?tab=grade`}
                    title={row.full_name}
                  >
                    {row.name || '—'}
                  </Link>
                </td>
                <td>
                  <Link
                    to={`/submission/${row.id}?tab=grade`}
                    title={row.full_name}
                  >
                    {row.surname || '—'}
                  </Link>
                </td>
                <td className="grade-score">
                  <Link to={`/submission/${row.id}?tab=grade`}>
                    {row.score === null
                      ? 'Not graded'
                      : `${row.score} / ${data.effective_max_grade}`}
                  </Link>
                </td>
                <td
                  title={
                    row.pasted_percent === null
                      ? 'Unavailable: the writing history is incomplete.'
                      : 'Share of final characters identified as pasted by the recorded history.'
                  }
                >
                  {row.pasted_percent === null
                    ? '—'
                    : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(row.pasted_percent)}%`}
                </td>
                <td>
                  <span
                    className={`grade-time ${row.on_time === false ? 'late' : ''}`}
                    title={
                      !assignment.deadline
                        ? 'No deadline was set.'
                        : row.on_time
                          ? 'Submitted by the deadline.'
                          : 'Submitted after the deadline.'
                    }
                  >
                    <span className="sr-only">
                      {row.on_time === null
                        ? 'Unknown'
                        : row.on_time
                          ? 'Complete on time'
                          : 'Late'}
                    </span>
                    {row.on_time === null ? (
                      '—'
                    ) : row.on_time ? (
                      <Check aria-hidden="true" />
                    ) : (
                      <X aria-hidden="true" />
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? <p className="empty-state">No submissions yet.</p> : null}
      <p className="grades-footnote">
        Names use the submitted full name: the first word as name, the remaining
        words as surname. “—” means the writing history is insufficient to
        calculate a pasted percentage. No deadline counts as on time.
      </p>
      {exportOpen ? (
        <MoodleExport
          assignment={assignment}
          data={data}
          onClose={() => setExportOpen(false)}
          onExported={(emails) =>
            setData((current) => ({
              ...current,
              rows: current.rows.map((r) => ({
                ...r,
                email: emails[r.id] ?? r.email,
              })),
            }))
          }
        />
      ) : null}
    </section>
  );
}
