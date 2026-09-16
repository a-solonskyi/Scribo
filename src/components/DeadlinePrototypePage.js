import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AssignmentDeadline from "./AssignmentDeadline";
import EssayEditor from "./EssayEditor";
import "./deadline-prototype.css";

const directions = [
  { id: "liquid", number: "04", name: "Refined", title: "One continuous flow.", description: "Paper cut bottle. Fine line glass. Liquid text, a curved stream, and a light spray at the rim.", material: "Liquid text · Curved pour · Rim spray" },
  { id: "line", number: "01", name: "Fine line", title: "A quiet measure of time.", description: "A fine contour, a thread of ink, a slowly rising glass. Time stays in the margin.", material: "Fine contour · Clear glass · Continuous thread" },
  { id: "ink", number: "02", name: "Dry ink", title: "Time, drawn by hand.", description: "An inky silhouette and etched glass. A little imperfection, like a drawing beside your words.", material: "Textured edges · Etched glass · Organic flow" },
  { id: "cut", number: "03", name: "Paper cut", title: "Every moment takes shape.", description: "Solid black, crisp edges, and a geometric glass. A small, graphic counterweight to the page.", material: "Solid silhouette · Faceted glass · Bold stream" },
];
const start = "2026-09-16T09:00:00+03:00";
const deadline = "2026-09-17T09:00:00+03:00";
const initialEssay = "<p>Writing is a way of paying attention. A thought that feels complete in the mind changes when we place it on a page: it asks for a shape, a rhythm, a little more care.</p><p>Perhaps that is why the blank page matters. It gives us room to notice what we mean before we decide how to say it.</p>";
const noop = () => {};

export default function DeadlinePrototypePage() {
  const [params, setParams] = useSearchParams();
  const variant = directions.find((item) => item.id === params.get("option"))?.id || "liquid";
  const direction = directions.find((item) => item.id === variant);
  const [progress, setProgress] = useState(0.62);
  const [playing, setPlaying] = useState(false);
  const activePlaying = playing && progress < 1.25;
  const [replayKey, setReplayKey] = useState(0);
  const [essay, setEssay] = useState(initialEssay);
  const onEssayChange = useCallback(({ html }) => setEssay(html), []);

  useEffect(() => {
    if (!activePlaying) return;
    let frame;
    let previous = performance.now();
    function tick(now) {
      // The accelerated clock crosses the deadline without resetting the glass.
      const delta = (now - previous) / 30000;
      previous = now;
      setProgress((value) => Math.min(1.25, value + delta));
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [activePlaying]);

  function setStage(value) {
    setPlaying(false);
    setProgress(value);
  }

  return <div className="deadline-prototype">
    <header className="prototype-header">
      <Link to="/prototypes/deadline" className="prototype-wordmark">[ˈskriː.boː]</Link>
      <Link className="prototype-header-label" to="/prototypes/deadline/compare">Compare motion</Link>
      <nav aria-label="Animation directions" className="prototype-options">
        {directions.map((item) => <button type="button" key={item.id} aria-pressed={variant === item.id} onClick={() => {
          setParams({ option: item.id });
          setPlaying(false);
        }}><span>{item.number}</span> {item.name}</button>)}
      </nav>
    </header>

    <div className="student-writing-layout has-deadline prototype-writing-layout">
      <aside className="student-deadline-rail" aria-label="Interactive deadline">
        <AssignmentDeadline key={`${variant}-${replayKey}`} deadline={deadline} startedAt={start} variant={variant} progressOverride={progress}
          displayNow={Date.parse(start) + progress * (Date.parse(deadline) - Date.parse(start))} />
        <div className="prototype-rail-caption"><span>{direction.number} / {direction.name}</span><span>{progress > 1 ? "Time is spilling over" : `${Math.round(progress * 100)}% of time elapsed`}</span></div>
      </aside>

      <main className="student-shell prototype-essay">
        <div className="student-header">
          <h1>The art of paying attention</h1>
          <button className="filled-button student-submit-button" type="button" disabled title="Sample essay for interaction review">Submit</button>
          <p className="prototype-assignment-copy">Explore how the act of writing changes the way we see. Consider the relationship between attention, time, and the words we choose.</p>
        </div>
        <div className="student-save-bar"><span className="student-save-status">Sample essay</span><span className="prototype-sample-note">A space to try the interaction</span></div>
        <label className="student-name-field"><input aria-label="Name and Surname" defaultValue="Alex Morgan" /></label>
        <EssayEditor essayHtml={essay} onEssayChange={onEssayChange} onPaste={noop} />
        <div className="prototype-end-mark" aria-hidden="true">/</div>

        <section className="prototype-review" aria-label="Prototype playback controls">
          <div className="prototype-direction-description"><div><p className="prototype-eyebrow">Study {direction.number} <span>—</span> {direction.name}</p><h2>{direction.title}</h2><p>{direction.description}</p></div><span className="prototype-direction-number" aria-hidden="true">{direction.number}</span></div>
          <div className="prototype-timeline-header"><span>Elapsed deadline</span><output aria-live="off">{Math.round(progress * 100)}% <span>{progress > 1 ? "/ Overflowing" : progress === 1 ? "/ Deadline reached" : "/ In progress"}</span></output></div>
          <input className="prototype-scrubber" type="range" min="0" max="125" step="0.1" value={progress * 100} onChange={(event) => setStage(Number(event.target.value) / 100)} aria-label="Elapsed deadline progress" aria-valuetext={`${Math.round(progress * 100)} percent elapsed${progress > 1 ? ", overflowing" : ""}`} style={{ "--progress": `${progress / 1.25 * 100}%` }} />
          <div className="prototype-timeline-labels"><button onClick={() => setStage(0)}>Start / Empty</button><button onClick={() => setStage(1)}>Deadline / Full</button><button onClick={() => setStage(1.18)}>After / Overflow</button></div>
          <div className="prototype-review-footer"><span>{direction.material}</span><div><button type="button" onClick={() => setReplayKey((value) => value + 1)}>Reset field ↺</button><button type="button" className="prototype-play" onClick={() => { if (progress >= 1.25) { setProgress(0); setPlaying(true); } else setPlaying((value) => !value); }}>{activePlaying ? "Ⅱ Pause" : "▷ Play timeline"}</button></div></div>
        </section>
        <footer className="prototype-page-footer"><Link to="/prototypes/deadline/compare">Compare before and after</Link><span>Paper cut bottle + Fine line glass</span></footer>
      </main>
    </div>
  </div>;
}
