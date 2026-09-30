import { useState } from "react";

import { createAssignment } from "../sites/database";
import { ErrorState } from "./LoadingState";
import InstructionsEditor from "./InstructionsEditor";
import DeadlinePicker from "./DeadlinePicker";
import { normalizeInstructions } from "../utils/assignmentInstructions";
import { localDeadlineToIso } from "../utils/deadlines";

export default function AssignmentCreateModal({
  classId,
  professorId,
  onCreated,
  onCancel,
}) {
  const [topic, setTopic] = useState("");
  const [instructions, setInstructions] = useState("");
  const [maxGrade, setMaxGrade] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (!topic.trim()) return;

    setSaving(true);
    setError("");
    try {
      const created = await createAssignment({
        classId,
        professorId,
        topic: topic.trim(),
        instructions: normalizeInstructions(instructions),
        deadline: localDeadlineToIso(deadline),
        max_grade: maxGrade === "" ? null : Number(maxGrade),
      });
      onCreated(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="modal-panel">
        <div className="page-header compact">
          <h2>New essay</h2>
          <button className="text-button" type="button" onClick={onCancel}>
            Close
          </button>
        </div>
        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            <span>Essay topic</span>
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Essay topic"
              required
            />
          </label>
          <div className="instructions-field">
            <span className="instructions-field-label">Instructions</span>
            <InstructionsEditor onChange={setInstructions} disabled={saving} />
          </div>
          <label className="assignment-max-grade">
            <span>Grade</span>
            <input type="number" inputMode="numeric" min="1" max="100" step="1"
              value={maxGrade} onChange={event => { if (/^\d*$/.test(event.target.value)) setMaxGrade(event.target.value); }}
              disabled={saving} placeholder="Optional" aria-describedby="maximum-grade-help" />
            <small id="maximum-grade-help">Maximum available score (1–100). Leave blank to use the default 100-point grading scale.</small>
          </label>
          <DeadlinePicker value={deadline} onChange={setDeadline} disabled={saving} />
          <ErrorState message={error} />
          <button className="filled-button create-essay-button" type="submit" disabled={saving}>
            {saving ? "Creating" : "Create essay"}
          </button>
        </form>
      </section>
    </div>
  );
}
