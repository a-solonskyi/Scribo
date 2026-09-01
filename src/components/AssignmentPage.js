import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  deleteSubmission,
  getAssignment,
  getSubmissionsForAssignment,
} from "../sites/database";
import { formatDateTime } from "../utils/timeFormatting";
import { ErrorState, LoadingState } from "./LoadingState";
import SubmissionList from "./SubmissionList";

export default function AssignmentPage() {
  const { assignmentId } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const studentLink = useMemo(() => {
    if (!assignment?.public_token) return "";
    return `${window.location.origin}/write/${assignment.public_token}`;
  }, [assignment]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [loadedAssignment, loadedSubmissions] = await Promise.all([
          getAssignment(assignmentId),
          getSubmissionsForAssignment(assignmentId),
        ]);
        setAssignment(loadedAssignment);
        setSubmissions(loadedSubmissions);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [assignmentId]);

  async function copyLink() {
    await navigator.clipboard.writeText(studentLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function handleDeleteSubmission(submission) {
    const confirmed = window.confirm(
      `Delete submission from ${submission.student_name}? This cannot be undone.`
    );
    if (!confirmed) return;

    setError("");
    try {
      await deleteSubmission(submission.id);
      setSubmissions((current) =>
        current.filter((item) => item.id !== submission.id)
      );
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <LoadingState label="Loading essay" />;

  return (
    <section className="page-section assignment-page">
      <Link
        className="text-button compact-back-link"
        to={`/class/${assignment?.class_id}`}
        aria-label="Back to class"
      >
        &lt;
      </Link>
      <div className="page-header">
        <div>
          <h1>{assignment?.topic}</h1>
          <p>{assignment?.instructions}</p>
          {assignment?.deadline ? (
            <p className="muted-line">Deadline: {formatDateTime(assignment.deadline)}</p>
          ) : null}
        </div>
      </div>
      <ErrorState message={error} />
      <div className="share-box">
        <div>
          <span>Student link</span>
          <strong>{studentLink}</strong>
        </div>
        <button className="filled-button" type="button" onClick={copyLink}>
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <h2>Submissions</h2>
      <SubmissionList
        submissions={submissions}
        onDelete={handleDeleteSubmission}
      />
    </section>
  );
}
