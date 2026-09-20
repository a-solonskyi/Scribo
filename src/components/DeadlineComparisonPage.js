import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AssignmentDeadline from "./AssignmentDeadline";
import "./deadline-comparison.css";

const start = "2026-09-16T09:00:00+03:00";
const deadline = "2026-09-17T09:00:00+03:00";

export default function DeadlineComparisonPage() {
  const [progress, setProgress] = useState(0.62);
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const active = playing && progress < 1.2;
  useEffect(() => {
    if (!active) return;
    let frame;
    let previous = performance.now();
    function tick(time) {
      const delta = Math.min(time - previous, 100) / 30000;
      previous = time;
      setProgress((value) => Math.min(1.2, value + delta));
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);
  function stage(value) { setPlaying(false); setProgress(value); }
  function replay() { setRun((value) => value + 1); }
  return <main className="deadline-comparison">
    <header className="comparison-header"><Link className="prototype-wordmark" to="/prototypes/deadline?option=liquid">[ˈskriː.boː]</Link><span>Deadline / Motion comparison</span><Link to="/prototypes/deadline?option=liquid">View in the editor</Link></header>
    <section className="comparison-heading"><div><h1>One gesture. A continuous flow.</h1><p>Paper cut bottle + Fine line glass</p></div><div className="comparison-playback"><button type="button" className="comparison-slow" aria-pressed={slow} onClick={() => { setSlow((value) => !value); replay(); }}>Slow motion</button><button type="button" className="comparison-replay" onClick={replay}>Replay both</button></div></section>
    <div className="comparison-panes">
      {[{ id: "liquid-previous", label: "Before", note: "Previous refinement" }, { id: "liquid", label: "Refined", note: "Liquid type · Elastic joins · Returning droplets" }].map((item) => <section key={item.id} className="comparison-pane" aria-label={item.label}>
        <div className="comparison-pane-heading"><h2>{item.label}</h2><span>{item.note}</span></div>
        <div className="deadline-comparison-stage">
          <AssignmentDeadline key={`${item.id}-${run}`} variant={item.id} deadline={deadline} startedAt={start} contained initiallyOpen={run > 0} motionRate={slow ? 0.3 : 1}
            progressOverride={progress} displayNow={Date.parse(start) + progress * (Date.parse(deadline) - Date.parse(start))} />
        </div>
      </section>)}
    </div>
    <section className="comparison-controls" aria-label="Shared deadline timeline">
      <div className="comparison-progress"><span>Elapsed deadline</span><output>{Math.round(progress * 100)}% <span>{progress > 1 ? " / Overflow" : progress === 1 ? " / Full" : ""}</span></output></div>
      <input type="range" min="0" max="120" step="0.1" value={progress * 100} onChange={(event) => stage(Number(event.target.value) / 100)} aria-label="Elapsed deadline progress" style={{ "--progress": `${progress / 1.2 * 100}%` }} />
      <div className="comparison-control-buttons"><div><button onClick={() => stage(0)}>Empty</button><button onClick={() => stage(0.62)}>62%</button><button onClick={() => stage(1)}>Deadline / Full</button><button onClick={() => stage(1.15)}>Overflow</button></div><button onClick={() => { if (progress >= 1.2) { setProgress(0); setPlaying(true); } else setPlaying((value) => !value); if (!run) replay(); }}>{active ? "Pause timeline" : "Play timeline"}</button></div>
    </section>
  </main>;
}
