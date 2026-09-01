import { useState } from "react";
import { Link } from "react-router-dom";

import { formatDateTime } from "../utils/timeFormatting";

function ChainIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
    </svg>
  );
}

export default function AssignmentCard({ assignment, onDelete }) {
  const [copied, setCopied] = useState(false);
  const dueDate = assignment.deadline
    ? `Due ${formatDateTime(assignment.deadline)}`
    : "No due date";

  async function copyStudentLink() {
    const studentLink = `${window.location.origin}/write/${assignment.public_token}`;
    await navigator.clipboard.writeText(studentLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flat-card action-card">
      <Link className="flat-card-main" to={`/assignment/${assignment.id}`}>
        <div>
          <h3>{assignment.topic}</h3>
          <p>{dueDate}</p>
        </div>
      </Link>
      <div className="assignment-card-actions">
        <div className="copy-feedback-wrap">
          {copied ? <span className="copy-callout">Copied!</span> : null}
          <button
            className="copy-icon-button"
            type="button"
            aria-label={`Copy student link for ${assignment.topic}`}
            title="Copy student link"
            onClick={copyStudentLink}
          >
            <ChainIcon />
          </button>
        </div>
        <button
          className="delete-icon-button"
          type="button"
          aria-label={`Delete essay topic ${assignment.topic}`}
          title="Delete essay topic"
          onClick={() => onDelete?.(assignment)}
        >
          ×
        </button>
      </div>
    </div>
  );
}
