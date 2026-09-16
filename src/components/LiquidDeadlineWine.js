import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { deadlineFill, deadlineProgress } from "../utils/deadlineProgress";
import { clamp, createDeadlineInk, deadlineBottlePath, deadlineStreamPath, ease } from "../utils/liquidDeadline";
import "./liquid-deadline-wine.css";

export default function LiquidDeadlineWine({ anchor, deadline, startedAt, progressOverride, onClose, contained = false }) {
  const id = useId().replace(/:/g, "");
  const root = useRef(null);
  const canvas = useRef(null);
  const bottle = useRef(null);
  const glass = useRef(null);
  const stream = useRef(null);
  const fill = useRef(null);
  const ripple = useRef(null);
  const spray = useRef(null);
  const completed = useRef(false);
  const [geometry, setGeometry] = useState(null);
  const progress = useRef(progressOverride);
  useEffect(() => { progress.current = progressOverride; }, [progressOverride]);

  useEffect(() => {
    const resize = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const container = contained ? anchor.current.closest(".deadline-comparison-stage") : null;
      const bounds = container?.getBoundingClientRect();
      const scale = !contained && window.innerWidth <= 700 ? 0.65 : 1;
      const top = bounds ? rect.top - bounds.top : rect.top;
      setGeometry({ container, scale, left: bounds ? rect.left - bounds.left : rect.left, top,
        height: Math.max(330, (bounds ? bounds.height : window.innerHeight) - top - (bounds ? 8 : 30)) });
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (anchor.current) observer.observe(contained ? anchor.current.closest(".deadline-comparison-stage") : document.documentElement);
    window.addEventListener("resize", resize);
    const close = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => { observer.disconnect(); window.removeEventListener("resize", resize); window.removeEventListener("keydown", close); };
  }, [anchor, contained, onClose]);

  const height = geometry ? geometry.height / geometry.scale : 600;
  const bowlTop = height - 228;
  const bowlBottom = height - 116;
  const bowl = `M71 ${bowlTop} C62 ${bowlTop + 51} 77 ${bowlBottom} 121 ${bowlBottom} C165 ${bowlBottom} 180 ${bowlTop + 51} 171 ${bowlTop} Z`;

  useEffect(() => {
    if (!geometry || !canvas.current) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const drawInk = createDeadlineInk(anchor.current, canvas.current, geometry.scale);
    // Hide the real text only after its pixels have been captured and the first frame painted.
    drawInk(0);
    anchor.current.classList.add("ink-captured");
    let frame;
    let lastTime = performance.now();
    let elapsed = completed.current ? 3000 : 0;
    let phase = 0;
    let lastProgress = null;
    function draw(time) {
      const delta = Math.min(64, time - lastTime);
      lastTime = time;
      elapsed += delta;
      if (!motion.matches) phase += delta / 750;
      const t = motion.matches ? 1 : clamp(elapsed / 2600);
      if (!completed.current) drawInk(t);
      if (t >= 1 && !completed.current) {
        completed.current = true;
        root.current.dataset.phase = "pouring";
      }
      canvas.current.style.opacity = t >= 1 ? "0" : "1";
      bottle.current.style.opacity = t >= 1 ? "1" : "0";
      glass.current.style.opacity = String(ease((t - 0.55) / 0.4));
      const raw = progress.current ?? deadlineProgress(startedAt, deadline);
      const level = deadlineFill(raw);
      const surface = bowlBottom - (bowlBottom - bowlTop) * level;
      const wave = level > 0 && level < 1 && !motion.matches ? Math.sin(phase * 1.5) * 1.1 : 0;
      fill.current.setAttribute("d", `M50 ${surface} Q87 ${surface + wave} 121 ${surface} T190 ${surface} V${bowlBottom + 2} H50 Z`);
      const pourIn = ease((elapsed - 2480) / 650);
      stream.current.style.opacity = t > 0.9 || motion.matches ? "1" : "0";
      stream.current.setAttribute("d", deadlineStreamPath(motion.matches ? surface : 138 + (surface - 138) * pourIn, phase));
      ripple.current.setAttribute("transform", `translate(121 ${surface}) scale(${1 + Math.sin(phase * 1.6) * 0.14} 1)`);
      ripple.current.setAttribute("opacity", level > 0 && level < 1 && t >= 1 ? ".7" : "0");
      const overflowing = raw > 1 && t >= 1;
      spray.current.setAttribute("opacity", overflowing ? "1" : "0");
      if (overflowing) {
        // Short ballistic droplets only around the rim. No long runoff or puddle.
        Array.from(spray.current.children).forEach((drop, index) => {
          const side = index % 2 ? 1 : -1;
          const age = motion.matches ? (index % 6 + 1) / 7 : (phase * 0.58 + index * 0.137) % 1;
          const x = (side < 0 ? 72 : 170) + side * (3 + age * (12 + index % 4 * 3));
          const y = bowlTop - Math.sin(age * Math.PI) * (9 + index % 4 * 3) + age * age * 26;
          drop.setAttribute("cx", x);
          drop.setAttribute("cy", y);
          drop.setAttribute("rx", String((0.65 + index % 3 * 0.25) * (1 - age * 0.4)));
          drop.setAttribute("ry", String(1 + age * 1.4));
          drop.setAttribute("opacity", String(Math.sin(Math.PI * age)));
        });
      }
      if (raw !== lastProgress) {
        root.current.dataset.progress = String(raw);
        root.current.dataset.overflow = String(overflowing);
        lastProgress = raw;
      }
      frame = requestAnimationFrame(draw);
    }
    const resume = () => {
      cancelAnimationFrame(frame);
      lastTime = performance.now();
      if (!document.hidden) frame = requestAnimationFrame(draw);
    };
    resume();
    document.addEventListener("visibilitychange", resume);
    const button = anchor.current;
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", resume); button?.classList.remove("ink-captured"); };
  }, [anchor, geometry, bowlTop, bowlBottom, deadline, startedAt]);

  if (!geometry) return null;
  return createPortal(<div ref={root} className={`deadline-wine liquid-deadline-wine${contained ? " wine-contained" : ""}`} data-phase="morphing"
    style={{ position: contained ? "absolute" : "fixed", left: geometry.left, top: geometry.top, width: 220 * geometry.scale, height: geometry.height }}>
    <canvas ref={canvas} className="deadline-ink-canvas" aria-hidden="true" style={{ left: -40 * geometry.scale, width: 300 * geometry.scale, height: 210 * geometry.scale }} />
    <svg className="wine-scene" viewBox={`0 0 220 ${height}`} fill="none" aria-hidden="true">
      <defs><clipPath id={`${id}-liquid-bowl`}><path d={bowl} /></clipPath></defs>
      <g ref={bottle} opacity="0" transform="translate(-35 0)">
        <path d={deadlineBottlePath} fill="black" stroke="black" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M47 33 L98 77 L78 99 L28 64 Z" fill="white" /><circle cx="62" cy="66" r="9" fill="black" />
        <path d="M143 115 L157 124" stroke="white" strokeWidth="2" />
      </g>
      <path ref={stream} className="liquid-stream" fill="black" opacity="0" />
      <g ref={glass} opacity="0">
        <g clipPath={`url(#${id}-liquid-bowl)`}>
          <path ref={fill} className="liquid-fill" fill="black" />
          <path d={`M82 ${bowlTop + 12} C77 ${bowlTop + 60} 92 ${bowlBottom - 14} 103 ${bowlBottom - 12}`} stroke="white" strokeWidth="1.5" />
          <ellipse ref={ripple} rx="9" ry="1.2" stroke="white" strokeWidth="0.6" />
        </g>
        <path d={bowl} stroke="black" strokeWidth="1.2" />
        <ellipse cx="121" cy={bowlTop} rx="50" ry="3" stroke="black" strokeWidth="0.75" />
        <path d={`M121 ${bowlBottom} V${height - 43} M88 ${height - 40} Q121 ${height - 47} 154 ${height - 40}`} stroke="black" strokeWidth="1.2" strokeLinecap="round" />
        <g ref={spray} className="liquid-rim-spray" fill="black" opacity="0">{Array.from({ length: 16 }, (_, i) => <ellipse key={i} rx="1" ry="1" />)}</g>
      </g>
    </svg>
    <button type="button" className="wine-close" onClick={onClose} aria-label="Restore deadline field" title="Restore deadline field (Esc)">×</button>
    <output className="sr-only">{progressOverride > 1 ? "The glass is full. Ink sprinkles from the rim." : "The glass fills as time elapses."} Press Escape to restore the deadline.</output>
  </div>, geometry.container || document.body);
}
