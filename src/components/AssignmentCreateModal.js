import { useState } from "react";

import { createAssignment } from "../sites/database";
import { ErrorState } from "./LoadingState";

export default function AssignmentCreateModal({
  classId,
  professorId,
  onCreated,
  onCancel,
}) {
  const [topic, setTopic] = useState("");
  const [instructions, setInstructions] = useState("");
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
        instructions: instructions.trim(),
        deadline: deadline || null,
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
          <label>
            <span>Instructions</span>
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Optional instructions"
              rows={5}
            />
          </label>
          <label>
            <span>Deadline</span>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </label>
          <ErrorState message={error} />
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? "Creating" : "Create essay"}
          </button>
        </form>
      </section>
    </div>
  );
}
