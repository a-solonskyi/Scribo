import { createElement, useEffect, useId, useMemo, useRef, useState } from "react";
import { parseInstructions } from "../utils/assignmentInstructions";

function renderInline(node, key) {
  if (node.type === "hardBreak") return <br key={key} />;
  const tags = { bold: "strong", italic: "em", underline: "u" };
  return <span key={key}>{(node.marks || []).reduce((text, mark) => createElement(tags[mark.type], null, text), node.text)}</span>;
}

export default function AssignmentInstructions({ instructions, collapsible = false }) {
  const id = useId();
  const contentRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [isLong, setIsLong] = useState(false);
  const doc = useMemo(() => parseInstructions(instructions), [instructions]);

  useEffect(() => {
    setExpanded(false);
    const content = contentRef.current;
    if (!content || !collapsible) return;
    const measure = () => setIsLong(content.scrollHeight > parseFloat(getComputedStyle(content).lineHeight) * 5 + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [instructions, collapsible]);

  if (!instructions) return null;
  return (
    <section className="assignment-instructions" aria-label="Essay instructions">
      <div id={id} className={`instructions-preview${collapsible && !expanded ? " is-collapsed" : ""}`}>
        <div ref={contentRef} className="instructions-content">
          {doc ? doc.content.map((node, index) => createElement(
            node.type === "heading" ? `h${node.attrs.level + 1}` : "p",
            { key: index },
            node.content.length ? node.content.map(renderInline) : <br />,
          )) : <p className="instructions-plain-text">{instructions}</p>}
        </div>
      </div>
      {collapsible && isLong ? <button
        className="draft-text-button instructions-toggle"
        type="button"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded((value) => !value)}
      >{expanded ? "Collapse instructions" : "Expand instructions"}</button> : null}
    </section>
  );
}
