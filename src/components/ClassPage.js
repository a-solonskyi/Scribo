import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  deleteAssignment,
  getAssignmentsForClass,
  getClass,
} from "../sites/database";
import AssignmentCard from "./AssignmentCard";
import AssignmentCreateModal from "./AssignmentCreateModal";
import { ErrorState, LoadingState } from "./LoadingState";

export default function ClassPage({ session }) {
  const { classId } = useParams();
  const [classInfo, setClassInfo] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const assignmentCount = useMemo(() => assignments.length, [assignments]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [loadedClass, loadedAssignments] = await Promise.all([
          getClass(classId),
          getAssignmentsForClass(classId),
        ]);
        setClassInfo(loadedClass);
        setAssignments(loadedAssignments);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [classId]);

  function handleCreated(assignment) {
    setAssignments((current) => [{ ...assignment, submissions: [] }, ...current]);
    setShowModal(false);
  }

  async function handleDeleteAssignment(assignment) {
    const confirmed = window.confirm(
      `Delete essay topic "${assignment.topic}" and all its submissions? This cannot be undone.`
    );
    if (!confirmed) return;

    setError("");
    try {
      await deleteAssignment(assignment.id);
      setAssignments((current) =>
        current.filter((item) => item.id !== assignment.id)
      );
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <LoadingState label="Loading class" />;

  return (
    <section className="page-section class-page">
      <Link
        className="text-button compact-back-link"
        to="/dashboard"
        aria-label="Back to classes"
      >
        &lt;
      </Link>
      <div className="page-header">
        <div>
          <h1>{classInfo?.name}</h1>
          <p>{classInfo?.description}</p>
        </div>
        <button
          className="filled-button class-new-essay-button"
          type="button"
          onClick={() => setShowModal(true)}
        >
          + New essay
        </button>
      </div>
      <ErrorState message={error} />
      <p className="muted-line">{assignmentCount} essay folders</p>
      <div className="item-grid">
        {assignments.map((assignment) => (
          <AssignmentCard
            key={assignment.id}
            assignment={assignment}
            onDelete={handleDeleteAssignment}
          />
        ))}
      </div>
      {!assignments.length ? (
        <p className="empty-state">No essays yet. Create the first assignment.</p>
      ) : null}
      {showModal ? (
        <AssignmentCreateModal
          classId={classId}
          professorId={session.user.id}
          onCreated={handleCreated}
          onCancel={() => setShowModal(false)}
        />
      ) : null}
    </section>
  );
}
