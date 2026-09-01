import { useEffect, useMemo, useRef, useState } from "react";

import {
  createResponseAnnotation,
  deleteResponseAnnotation,
  deleteResponseAnnotations,
  getResponseAnnotations,
  updateResponseAnnotation,
} from "../sites/database";
import { downloadAnnotatedResponsePdf } from "../utils/annotatedResponsePdf";
import { ErrorState, LoadingState } from "./LoadingState";

function getRangeOffsets(container) {
  if (!container) return null;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  if (
    !container.contains(range.commonAncestorContainer) &&
    range.commonAncestorContainer !== container
  ) {
    return null;
  }

  const startRange = document.createRange();
  startRange.selectNodeContents(container);
  startRange.setEnd(range.startContainer, range.startOffset);

  const endRange = document.createRange();
  endRange.selectNodeContents(container);
  endRange.setEnd(range.endContainer, range.endOffset);

  const start = startRange.toString().length;
  const end = endRange.toString().length;
  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
  };
}

function buildTextSegments(text, annotations) {
  const textAnnotations = annotations
    .filter((item) => ["highlight", "comment"].includes(item.type))
    .filter((item) => item.end_offset > item.start_offset)
    .sort((a, b) => a.start_offset - b.start_offset);
  const segments = [];
  let cursor = 0;
  let commentNumber = 1;

  for (const annotation of textAnnotations) {
    const start = Math.max(cursor, Math.min(text.length, annotation.start_offset));
    const end = Math.max(start, Math.min(text.length, annotation.end_offset));
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), annotation: null });
    }
    if (end > start) {
      segments.push({
        text: text.slice(start, end),
        annotation: {
          ...annotation,
          commentNumber: annotation.type === "comment" ? commentNumber : null,
        },
      });
      if (annotation.type === "comment") commentNumber += 1;
    }
    cursor = end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), annotation: null });
  }

  return segments.length ? segments : [{ text, annotation: null }];
}

function strokeToPath(points = []) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5 H19 V15 H11 L7 19 V15 H5 Z" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 7 H15.2 C18.2 7 20 8.8 20 11.5 C20 14.2 18.2 16 15.2 16 H8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M9.4 3.8 L4.2 7 L9.4 10.2 Z" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M15 7 H8.8 C5.8 7 4 8.8 4 11.5 C4 14.2 5.8 16 8.8 16 H16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M14.6 3.8 L19.8 7 L14.6 10.2 Z" />
    </svg>
  );
}

export default function ResponseTab({ submission, professorId }) {
  const [annotations, setAnnotations] = useState([]);
  const [tool, setTool] = useState("select");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draftStroke, setDraftStroke] = useState(null);
  const [selectionAnchor, setSelectionAnchor] = useState(null);
  const [redoStack, setRedoStack] = useState([]);
  const essayRef = useRef(null);
  const paperRef = useRef(null);
  const drawingRef = useRef(null);
  const text = submission.final_text || "";
  const textSegments = useMemo(
    () => buildTextSegments(text, annotations),
    [text, annotations]
  );
  const comments = annotations.filter((item) => item.type === "comment");
  const drawings = annotations.filter((item) => item.type === "drawing");

  useEffect(() => {
    async function loadAnnotations() {
      setLoading(true);
      setError("");
      try {
        setAnnotations(await getResponseAnnotations(submission.id));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadAnnotations();
  }, [submission.id]);

  function updateSelectionAnchor() {
    if (tool !== "select") {
      setSelectionAnchor(null);
      return;
    }

    const range = getRangeOffsets(essayRef.current);
    if (!range || range.end <= range.start) {
      setSelectionAnchor(null);
      return;
    }

    const selection = window.getSelection();
    const selectionRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const rects = selectionRange?.getClientRects ? selectionRange.getClientRects() : [];
    const rect = rects[0] || selectionRange?.getBoundingClientRect?.();
    const paperRect = paperRef.current?.getBoundingClientRect();
    if (!rect || !paperRect) {
      setSelectionAnchor(null);
      return;
    }

    setSelectionAnchor({
      range,
      top: rect.top - paperRect.top - 42,
      left: rect.left - paperRect.left + rect.width / 2,
    });
  }

  async function createCommentFromSelection() {
    const range = selectionAnchor?.range;
    if (!range || range.end <= range.start) return;

    const commentText = window.prompt("Professor comment")?.trim();
    if (!commentText) return;

    setSaving(true);
    setError("");
    try {
      const created = await createResponseAnnotation({
        submission_id: submission.id,
        professor_id: professorId,
        type: "comment",
        start_offset: range.start,
        end_offset: range.end,
        text_quote: text.slice(range.start, range.end),
        comment_text: commentText,
        color: "yellow",
      });
      setAnnotations((current) => [...current, created]);
      setSelectionAnchor(null);
      window.getSelection()?.removeAllRanges();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function getSvgPoint(event) {
    const rect = drawingRef.current.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 1000,
      y: ((event.clientY - rect.top) / rect.height) * 1000,
    };
  }

  function startDrawing(event) {
    if (tool !== "pen") return;
    event.preventDefault();
    drawingRef.current.setPointerCapture(event.pointerId);
    setDraftStroke([getSvgPoint(event)]);
  }

  function continueDrawing(event) {
    if (tool !== "pen" || !draftStroke) return;
    setDraftStroke((current) => [...current, getSvgPoint(event)]);
  }

  async function finishDrawing() {
    if (tool !== "pen" || !draftStroke) return;
    const stroke = draftStroke;
    setDraftStroke(null);
    if (stroke.length < 2) return;

    setSaving(true);
    setError("");
    try {
      const created = await createResponseAnnotation({
        submission_id: submission.id,
        professor_id: professorId,
        type: "drawing",
        color: "ink",
        drawing_path_json: { points: stroke },
      });
      setAnnotations((current) => [...current, created]);
      setRedoStack([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeAnnotation(annotationId) {
    setSaving(true);
    setError("");
    try {
      await deleteResponseAnnotation(annotationId);
      setAnnotations((current) => current.filter((item) => item.id !== annotationId));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function editComment(annotation) {
    const nextText = window.prompt("Edit comment", annotation.comment_text || "")?.trim();
    if (!nextText) return;

    setSaving(true);
    setError("");
    try {
      const updated = await updateResponseAnnotation(annotation.id, {
        comment_text: nextText,
      });
      setAnnotations((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function undoLastDrawing() {
    const lastDrawing = drawings.at(-1);
    if (!lastDrawing) return;
    setRedoStack((current) => [...current, lastDrawing]);
    await removeAnnotation(lastDrawing.id);
  }

  async function redoLastDrawing() {
    const drawing = redoStack.at(-1);
    if (!drawing) return;

    setSaving(true);
    setError("");
    try {
      const created = await createResponseAnnotation({
        submission_id: submission.id,
        professor_id: professorId,
        type: "drawing",
        color: drawing.color || "ink",
        drawing_path_json: drawing.drawing_path_json,
      });
      setAnnotations((current) => [...current, created]);
      setRedoStack((current) => current.slice(0, -1));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function clearDrawings() {
    if (!drawings.length) return;
    if (!window.confirm("Clear all pen drawings?")) return;

    setSaving(true);
    setError("");
    try {
      await deleteResponseAnnotations(drawings.map((item) => item.id));
      setAnnotations((current) => current.filter((item) => item.type !== "drawing"));
      setRedoStack([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function exportAnnotatedPdf() {
    setSaving(true);
    setError("");
    try {
      await downloadAnnotatedResponsePdf({ submission, annotations });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Loading response annotations" />;

  return (
    <div className="response-tab">
      <div className="response-toolbar">
        <button
          className={tool === "pen" ? "active" : undefined}
          type="button"
          onClick={() => {
            setSelectionAnchor(null);
            setTool(tool === "pen" ? "select" : "pen");
          }}
        >
          Pen
        </button>
        <button
          className={tool === "eraser" ? "active" : undefined}
          type="button"
          onClick={() => {
            setSelectionAnchor(null);
            setTool(tool === "eraser" ? "select" : "eraser");
          }}
        >
          Eraser
        </button>
        <button
          className="response-icon-button"
          type="button"
          onClick={undoLastDrawing}
          aria-label="Undo last drawing stroke"
          title="Undo"
        >
          <UndoIcon />
        </button>
        <button
          className="response-icon-button"
          type="button"
          onClick={redoLastDrawing}
          aria-label="Redo drawing stroke"
          title="Redo"
        >
          <RedoIcon />
        </button>
        <button type="button" onClick={clearDrawings}>
          Clear drawings
        </button>
        <button
          className="filled-button"
          type="button"
          onClick={exportAnnotatedPdf}
        >
          Export PDF
        </button>
        {saving ? <span>Saving...</span> : null}
      </div>

      <ErrorState message={error} />

      <div className="response-layout">
        <div className="response-paper" ref={paperRef}>
          {selectionAnchor ? (
            <button
              className="selection-comment-button"
              type="button"
              style={{
                left: `${selectionAnchor.left}px`,
                top: `${Math.max(0, selectionAnchor.top)}px`,
              }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={createCommentFromSelection}
              aria-label="Add comment to selected text"
              title="Add comment"
            >
              <CommentIcon />
            </button>
          ) : null}
          <div
            className="response-essay"
            ref={essayRef}
            onMouseUp={() => window.setTimeout(updateSelectionAnchor, 0)}
            onKeyUp={updateSelectionAnchor}
          >
            {textSegments.map((segment, index) => {
              const annotation = segment.annotation;
              if (!annotation) {
                return <span key={`plain-${index}`}>{segment.text}</span>;
              }

              return (
                <mark
                  className={`response-mark ${annotation.color || "yellow"}`}
                  id={`annotation-${annotation.id}`}
                  key={annotation.id}
                  title={annotation.comment_text || annotation.text_quote}
                >
                  {segment.text}
                  {annotation.type === "comment" ? (
                    <sup>{annotation.commentNumber}</sup>
                  ) : null}
                </mark>
              );
            })}
          </div>
          <svg
            className={tool === "pen" || tool === "eraser" ? "drawing-layer active" : "drawing-layer"}
            ref={drawingRef}
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            onPointerDown={startDrawing}
            onPointerMove={continueDrawing}
            onPointerUp={finishDrawing}
            onPointerCancel={() => setDraftStroke(null)}
          >
            {drawings.map((drawing) => (
              <path
                className={tool === "eraser" ? "drawing-stroke erasable" : "drawing-stroke"}
                d={strokeToPath(drawing.drawing_path_json?.points || [])}
                key={drawing.id}
                onClick={() => {
                  if (tool === "eraser") removeAnnotation(drawing.id);
                }}
              />
            ))}
            {draftStroke ? (
              <path className="drawing-stroke draft" d={strokeToPath(draftStroke)} />
            ) : null}
          </svg>
        </div>

        <aside className="response-comments">
          <h2>Comments</h2>
          {comments.length ? (
            comments.map((comment, index) => (
              <div className="response-comment" key={comment.id}>
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById(`annotation-${comment.id}`)
                      ?.scrollIntoView({ block: "center", behavior: "smooth" })
                  }
                >
                  Comment {index + 1}
                </button>
                <p>{comment.comment_text}</p>
                <small>{comment.text_quote}</small>
                <div>
                  <button type="button" onClick={() => editComment(comment)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => removeAnnotation(comment.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="empty-state">No comments yet.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
