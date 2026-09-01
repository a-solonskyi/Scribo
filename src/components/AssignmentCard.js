import { useState } from "react";
import { Link } from "react-router-dom";

import { formatDateTime } from "../utils/timeFormatting";

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
        <button
          className="filled-button"
          type="button"
          aria-label={`Copy student link for ${assignment.topic}`}
          onClick={copyStudentLink}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
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
