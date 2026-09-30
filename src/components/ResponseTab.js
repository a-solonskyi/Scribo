import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Highlighter, StickyNote, MessageSquarePlus, X } from 'lucide-react';
import {
  createResponseAnnotation,
  deleteResponseAnnotation,
  getResponseAnnotations,
  updateResponseAnnotation,
} from '../sites/database';
import { downloadAnnotatedResponsePdf } from '../utils/annotatedResponsePdf';
import { buildResponseSegments } from '../utils/responseAnnotations';
import { ErrorState, LoadingState } from './LoadingState';

function selectedRange(container) {
  const selection = window.getSelection();
  if (!container || !selection?.rangeCount || selection.isCollapsed)
    return null;
  const range = selection.getRangeAt(0);
  if (
    !container.contains(range.startContainer) ||
    !container.contains(range.endContainer)
  )
    return null;
  const prefix = document.createRange();
  prefix.selectNodeContents(container);
  prefix.setEnd(range.startContainer, range.startOffset);
  const start = prefix.toString().length;
  prefix.setEnd(range.endContainer, range.endOffset);
  const end = prefix.toString().length;
  const rects = [...range.getClientRects()];
  const rect =
    rects.find((r) => r.bottom > 0 && r.top < window.innerHeight) ||
    rects[0] ||
    range.getBoundingClientRect();
  return { start, end, rect };
}
function caretRect(container, offset) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node,
    left = offset,
    last;
  while ((node = walker.nextNode())) {
    last = node;
    if (left <= node.length) {
      const range = document.createRange();
      range.setStart(node, left);
      range.collapse(true);
      const rect = range.getClientRects()[0];
      if (rect) return rect;
      if (node.length) {
        range.setStart(node, Math.max(0, left - 1));
        range.setEnd(node, Math.min(node.length, Math.max(1, left)));
        return range.getBoundingClientRect();
      }
    }
    left -= node.length;
  }
  return (
    last?.parentElement?.getBoundingClientRect() ||
    container.getBoundingClientRect()
  );
}
function offsetAtPoint(container, x, y) {
  const caret = document.caretPositionFromPoint?.(x, y);
  const range = !caret && document.caretRangeFromPoint?.(x, y);
  const node = caret?.offsetNode || range?.startContainer;
  const offset = caret?.offset ?? range?.startOffset;
  if (node && container.contains(node)) {
    const prefix = document.createRange();
    prefix.selectNodeContents(container);
    prefix.setEnd(node, offset);
    return prefix.toString().length;
  }
  return y < container.getBoundingClientRect().top
    ? 0
    : container.textContent.length;
}

export default function ResponseTab({ submission }) {
  const [annotations, setAnnotations] = useState([]),
    [tool, setTool] = useState('select');
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  const [selection, setSelection] = useState(null),
    [popup, setPopup] = useState(null),
    [noteText, setNoteText] = useState('');
  const [floating, setFloating] = useState(false),
    [pinPositions, setPinPositions] = useState({});
  const essayRef = useRef(null),
    paperRef = useRef(null),
    toolbarRef = useRef(null),
    busyRef = useRef(false),
    inputRef = useRef(null);
  const text = submission.final_text || '';
  const segments = useMemo(
    () => buildResponseSegments(text, annotations),
    [text, annotations],
  );
  const notes = annotations.filter((a) => a.type === 'note');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setPopup(null);
    setSelection(null);
    setTool('select');
    getResponseAnnotations(submission.id)
      .then((rows) => {
        if (active) setAnnotations(rows);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [submission.id]);
  useLayoutEffect(() => {
    if (loading || !paperRef.current) return;
    const update = () => {
      if (!paperRef.current || !essayRef.current) return;
      const paper = paperRef.current.getBoundingClientRect();
      const lineHeight = parseFloat(
        getComputedStyle(essayRef.current).lineHeight,
      );
      const positions = {};
      for (const note of annotations.filter((a) => a.type === 'note')) {
        const rect = caretRect(essayRef.current, note.start_offset || 0),
          p = note.note_position;
        positions[note.id] = {
          left: Math.max(
            0,
            Math.min(paper.width - 22, (p?.xRatio ?? 0.5) * paper.width),
          ),
          top: Math.max(
            0,
            rect.top - paper.top + (p?.lineOffset || 0) * lineHeight,
          ),
        };
      }
      setPinPositions(positions);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(paperRef.current);
    document.fonts?.ready.then(update);
    return () => observer.disconnect();
  }, [annotations, loading, text]);
  useEffect(() => {
    if (loading) return;
    const update = () => {
      const toolbar = toolbarRef.current?.getBoundingClientRect(),
        paper = paperRef.current?.getBoundingClientRect();
      setFloating(
        Boolean(
          toolbar &&
          paper &&
          toolbar.bottom <= 0 &&
          paper.bottom > 100 &&
          paper.top < window.innerHeight,
        ),
      );
    };
    const observer = new IntersectionObserver(update, { threshold: [0, 1] });
    if (toolbarRef.current) observer.observe(toolbarRef.current);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [loading]);
  useEffect(() => {
    if (popup && popup.type !== 'highlight') inputRef.current?.focus();
  }, [popup?.id, popup?.type, popup?.x, popup?.y]);

  async function mutate(action) {
    if (busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e.message);
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }
  function chooseTool(next) {
    if (saving || popup) return;
    setTool((current) => (current === next ? 'select' : next));
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }
  function showPopup(annotation, x, y, related = []) {
    setPopup({ ...annotation, x, y, related });
    setNoteText(annotation.comment_text || '');
    setSelection(null);
    setTool('select');
    window.getSelection()?.removeAllRanges();
  }
  function openAnnotation(annotation, event, related = []) {
    event.stopPropagation();
    if (tool !== 'select' || selectedRange(essayRef.current) || popup || saving)
      return;
    const paper = paperRef.current.getBoundingClientRect(),
      rect = event.currentTarget.getBoundingClientRect();
    showPopup(
      annotation,
      rect.left - paper.left,
      rect.bottom - paper.top,
      related,
    );
  }
  function handleSelection() {
    if (saving || popup || tool === 'note') return;
    const range = selectedRange(essayRef.current);
    if (!range || range.end <= range.start) {
      setSelection(null);
      return;
    }
    if (tool === 'highlight') {
      setTool('select');
      window.getSelection()?.removeAllRanges();
      mutate(async () => {
        const created = await createResponseAnnotation({
          submission_id: submission.id,
          type: 'highlight',
          start_offset: range.start,
          end_offset: range.end,
          color: 'yellow',
        });
        setAnnotations((current) => [...current, created]);
      });
    } else {
      const paper = paperRef.current.getBoundingClientRect();
      setSelection({
        start: range.start,
        end: range.end,
        x: range.rect.left - paper.left + range.rect.width / 2,
        y: range.rect.top - paper.top,
      });
    }
  }
  function placeNote(event) {
    if (
      tool !== 'note' ||
      popup ||
      saving ||
      event.target.closest('button,textarea,[role="dialog"]')
    )
      return;
    const paper = paperRef.current.getBoundingClientRect(),
      x = event.clientX - paper.left,
      y = event.clientY - paper.top;
    const offset = offsetAtPoint(
      essayRef.current,
      event.clientX,
      event.clientY,
    );
    const caret = caretRect(essayRef.current, offset),
      lineHeight = parseFloat(getComputedStyle(essayRef.current).lineHeight);
    showPopup(
      {
        type: 'note',
        start_offset: offset,
        end_offset: offset,
        note_position: {
          version: 1,
          xRatio: x / paper.width,
          lineOffset: Math.max(
            -40,
            Math.min(40, (event.clientY - caret.top) / lineHeight),
          ),
        },
      },
      x,
      y,
    );
  }
  function saveNote(event) {
    event.preventDefault();
    if (!popup || !noteText.trim()) return;
    mutate(async () => {
      const saved = popup.id
        ? await updateResponseAnnotation(popup.id, { comment_text: noteText })
        : await createResponseAnnotation({
            submission_id: submission.id,
            type: popup.type,
            start_offset: popup.start_offset,
            end_offset: popup.end_offset,
            note_position: popup.note_position,
            comment_text: noteText,
            color: popup.type === 'comment' ? 'blue' : 'yellow',
          });
      setAnnotations((current) =>
        popup.id
          ? current.map((a) => (a.id === saved.id ? saved : a))
          : [...current, saved],
      );
      setPopup(null);
    });
  }
  function removeNote() {
    if (!popup.id) {
      setPopup(null);
      return;
    }
    mutate(async () => {
      await deleteResponseAnnotation(popup.id);
      setAnnotations((current) => current.filter((a) => a.id !== popup.id));
      setPopup(null);
    });
  }
  function tools() {
    return (
      <>
        <button
          type="button"
          className={`response-tool ${tool === 'highlight' ? 'active' : ''}`}
          aria-label="Highlight"
          title="Highlight the next text selection"
          aria-pressed={tool === 'highlight'}
          disabled={saving || Boolean(popup)}
          onClick={() => chooseTool('highlight')}
        >
          <Highlighter aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`response-tool ${tool === 'note' ? 'active' : ''}`}
          aria-label="Note"
          title="Place a note on the essay"
          aria-pressed={tool === 'note'}
          disabled={saving || Boolean(popup)}
          onClick={() => chooseTool('note')}
        >
          <StickyNote aria-hidden="true" />
        </button>
      </>
    );
  }
  if (loading) return <LoadingState label="Loading response annotations" />;
  return (
    <div
      className="response-tab"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !saving) {
          setTool('select');
          setSelection(null);
          if (!popup || noteText === (popup.comment_text || '')) setPopup(null);
        }
      }}
    >
      <div
        className="response-toolbar"
        ref={toolbarRef}
        role="toolbar"
        aria-label="Essay feedback"
      >
        {tools()}
        <button
          className="filled-button"
          type="button"
          disabled={saving || Boolean(popup)}
          onClick={() =>
            mutate(() =>
              downloadAnnotatedResponsePdf({ submission, annotations }),
            )
          }
        >
          Export PDF
        </button>
        <span role="status">
          {saving
            ? 'Saving…'
            : tool === 'highlight'
              ? 'Select text to highlight'
              : tool === 'note'
                ? 'Click the essay to place a note'
                : ''}
        </span>
      </div>
      <ErrorState message={error} />
      <div className="response-layout">
        <div
          className={`response-paper ${tool === 'note' ? 'placing-note' : ''}`}
          ref={paperRef}
          onClick={placeNote}
        >
          {selection && !popup ? (
            <button
              className="selection-comment-button"
              type="button"
              style={{
                left: Math.max(18, selection.x),
                top: Math.max(0, selection.y - 38),
              }}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() =>
                showPopup(
                  {
                    type: 'comment',
                    start_offset: selection.start,
                    end_offset: selection.end,
                  },
                  selection.x,
                  selection.y,
                )
              }
              aria-label="Add comment to selected text"
              title="Add comment"
            >
              <MessageSquarePlus aria-hidden="true" />
            </button>
          ) : null}
          <div
            className="response-essay"
            ref={essayRef}
            onPointerUp={() => window.setTimeout(handleSelection, 0)}
            onKeyUp={handleSelection}
          >
            {segments.map((segment) => {
              const comments = segment.annotations.filter(
                  (a) => a.type === 'comment',
                ),
                active = comments.length ? comments : segment.annotations;
              return active.length ? (
                <mark
                  key={segment.start}
                  className={`response-mark ${comments.length ? 'blue' : 'yellow'}`}
                  role="button"
                  tabIndex={0}
                  aria-label={
                    comments.length
                      ? 'Open note on selected text'
                      : 'Open highlight'
                  }
                  onClick={(e) => openAnnotation(active[0], e, active)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openAnnotation(active[0], e, active);
                    }
                  }}
                >
                  {segment.text}
                </mark>
              ) : (
                <span key={segment.start}>{segment.text}</span>
              );
            })}
          </div>
          {notes.map((note, i) => (
            <button
              type="button"
              className="response-note-pin"
              key={note.id}
              style={pinPositions[note.id]}
              aria-label={`Open note ${i + 1}`}
              title="Open note"
              onClick={(e) => openAnnotation(note, e)}
            >
              <StickyNote aria-hidden="true" />
            </button>
          ))}
          {popup ? (
            <form
              role="dialog"
              aria-label={popup.type === 'highlight' ? 'Highlight' : 'Note'}
              className="response-note-popover"
              style={{
                left: Math.max(
                  0,
                  Math.min(
                    popup.x,
                    (paperRef.current?.clientWidth || 320) - 320,
                  ),
                ),
                top: Math.max(
                  0,
                  Math.min(
                    popup.y + 12,
                    window.innerHeight -
                      (paperRef.current?.getBoundingClientRect().top || 0) -
                      300,
                  ),
                ),
              }}
              onSubmit={saveNote}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="response-note-heading">
                <strong>
                  {popup.type === 'highlight' ? 'Highlight' : 'Note'}
                </strong>
                <button
                  type="button"
                  className="response-note-delete"
                  aria-label={
                    popup.id
                      ? popup.type === 'highlight'
                        ? 'Delete highlight'
                        : 'Delete note'
                      : 'Discard note'
                  }
                  title={popup.id ? 'Delete' : 'Discard'}
                  disabled={saving}
                  onClick={removeNote}
                >
                  <X aria-hidden="true" />
                </button>
              </div>
              {popup.related?.length > 1 ? (
                <div className="response-related-notes">
                  {popup.related.map((a, i) => (
                    <button
                      type="button"
                      key={a.id}
                      disabled={saving}
                      onClick={() => {
                        setPopup({
                          ...a,
                          x: popup.x,
                          y: popup.y,
                          related: popup.related,
                        });
                        setNoteText(a.comment_text || '');
                      }}
                    >
                      Note {i + 1}
                    </button>
                  ))}
                </div>
              ) : null}
              {popup.type !== 'highlight' ? (
                <>
                  <label className="sr-only" htmlFor="response-note-text">
                    Note text
                  </label>
                  <textarea
                    id="response-note-text"
                    ref={inputRef}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Write your note…"
                    maxLength={10000}
                    rows={5}
                    disabled={saving}
                  />
                </>
              ) : (
                <p>Selected text is highlighted yellow.</p>
              )}
              <ErrorState message={error} />
              <div className="response-note-actions">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setPopup(null)}
                >
                  {popup.id ? 'Close' : 'Cancel'}
                </button>
                {popup.type !== 'highlight' ? (
                  <button
                    type="submit"
                    className="filled-button"
                    disabled={saving || !noteText.trim()}
                  >
                    {saving ? 'Saving…' : 'Save note'}
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}
        </div>
        <aside
          className={`response-floating-tools ${floating ? 'is-visible' : ''}`}
          aria-label="Floating essay tools"
          inert={!floating ? true : undefined}
          aria-hidden={!floating}
        >
          {tools()}
        </aside>
      </div>
    </div>
  );
}
