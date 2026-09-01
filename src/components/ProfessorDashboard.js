import { useEffect, useState } from "react";

import { createClass, deleteClass, getClasses } from "../sites/database";
import ClassList from "./ClassList";
import { ErrorState, LoadingState } from "./LoadingState";

export default function ProfessorDashboard({ session }) {
  const [classes, setClasses] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadClasses();
  }, []);

  async function loadClasses() {
    setLoading(true);
    setError("");
    try {
      setClasses(await getClasses());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateClass(event) {
    event.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError("");
    try {
      const created = await createClass({
        professorId: session.user.id,
        name: name.trim(),
        description: description.trim(),
      });
      setClasses((current) => [created, ...current]);
      window.dispatchEvent(new Event("classes-updated"));
      setName("");
      setDescription("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClass(item) {
    const confirmed = window.confirm(
      `Delete class "${item.name}" and all its essay topics/submissions? This cannot be undone.`
    );
    if (!confirmed) return;

    setError("");
    try {
      await deleteClass(item.id);
      setClasses((current) => current.filter((classItem) => classItem.id !== item.id));
      window.dispatchEvent(new Event("classes-updated"));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Classes</p>
          <h1>Professor dashboard</h1>
        </div>
      </div>

      <form className="inline-create" onSubmit={handleCreateClass}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Class name"
          required
        />
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description optional"
        />
        <button className="filled-button" type="submit" disabled={saving}>
          + New class
        </button>
      </form>

      <ErrorState message={error} />
      {loading ? (
        <LoadingState label="Loading classes" />
      ) : (
        <ClassList classes={classes} onDelete={handleDeleteClass} />
      )}
    </section>
  );
}
