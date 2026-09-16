import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { deadlineFill, deadlineProgress } from "../utils/deadlineProgress";
import "./deadline-wine.css";

const bottlePath = "M40 14 Q30 15 28 26 L16 58 Q11 69 22 77 L80 113 Q93 120 104 115 L114 110 L139 126 L139 130 L153 139 L163 121 L148 112 L144 114 L120 98 L118 83 Q117 73 105 66 L55 19 Q49 14 40 14 Z";
const blotPath = "M34 47 C47 22 75 42 94 28 C116 13 119 50 140 53 C173 59 149 79 167 92 C178 117 141 125 122 112 C101 139 75 117 63 123 C32 135 33 103 17 99 C-3 84 16 59 34 47 Z";
const smooth = (t) => t * t * (3 - 2 * t);

function samplePath(path) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", "path");
  element.setAttribute("d", path);
  const length = element.getTotalLength();
  return Array.from({ length: 120 }, (_, index) => {
    const point = element.getPointAtLength((index / 120) * length);
    return [point.x, point.y];
  });
}

function morphPath(from, to, amount) {
  return from.map(([x, y], i) => `${i ? "L" : "M"}${x + (to[i][0] - x) * amount},${y + (to[i][1] - y) * amount}`).join(" ") + "Z";
}

export default function DeadlineWine({ variant, anchor, startedAt, deadline, progressOverride, onClose, contained = false }) {
  const glassVariant = variant === "hybrid" ? "line" : variant;
  const id = useId().replace(/:/g, "");
  const morphRef = useRef(null);
  const fillRef = useRef(null);
  const streamRef = useRef(null);
  const rippleRef = useRef(null);
  const overflowRef = useRef(null);
  const morphComplete = useRef(false);
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [geometry, setGeometry] = useState(null);
  const progressRef = useRef(progressOverride);
  useEffect(() => { progressRef.current = progressOverride; }, [progressOverride]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    const resize = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const container = contained ? anchor.current.closest(".deadline-comparison-stage") : null;
      if (container) {
        const bounds = container.getBoundingClientRect();
        setGeometry({ left: rect.left - bounds.left, top: rect.top - bounds.top, height: bounds.bottom - rect.top - 8, scale: 1, container });
        return;
      }
      const mobile = window.innerWidth <= 700;
      const top = mobile ? Math.min(rect.top, 130) : Math.max(24, Math.min(rect.top, window.innerHeight - 390));
      setGeometry({
        left: mobile ? 10 : Math.max(8, Math.min(rect.left, window.innerWidth - 236)),
        top,
        height: Math.max(330, window.innerHeight - top - (mobile ? 24 : 30)),
        scale: mobile ? 0.65 : 1,
      });
    };
    updateMotion();
    resize();
    media.addEventListener("change", updateMotion);
    window.addEventListener("resize", resize);
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      media.removeEventListener("change", updateMotion);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
    };
  }, [anchor, onClose, contained]);

  const height = geometry ? geometry.height / geometry.scale : 600;
  const bowlTop = height - 228;
  const bowlBottom = height - (glassVariant === "cut" ? 125 : 116);
  const bowlPath = glassVariant === "cut"
    ? `M64 ${bowlTop} H178 L151 ${bowlBottom - 12} L121 ${bowlBottom} L91 ${bowlBottom - 12} Z`
    : glassVariant === "ink"
      ? `M65 ${bowlTop} C60 ${bowlTop + 47} 69 ${bowlBottom - 6} 119 ${bowlBottom} C172 ${bowlBottom - 2} 185 ${bowlTop + 48} 174 ${bowlTop} Z`
      : `M71 ${bowlTop} C62 ${bowlTop + 51} 77 ${bowlBottom} 121 ${bowlBottom} C165 ${bowlBottom} 180 ${bowlTop + 51} 171 ${bowlTop} Z`;

  useEffect(() => {
    if (!geometry) return;
    let frame;
    let disposed = false;
    const started = performance.now();
    const from = samplePath("M35 4 H217 V65 H35 Z");
    const blot = samplePath(blotPath);
    const bottle = samplePath(bottlePath);
    function draw(time) {
      if (disposed) return;
      const elapsed = time - started;
      const done = morphComplete.current || reducedMotion || elapsed >= 1650;
      const rawProgress = progressRef.current ?? deadlineProgress(startedAt, deadline);
      const fill = deadlineFill(rawProgress);
      const surface = bowlBottom - (bowlBottom - bowlTop) * fill;
      const phase = reducedMotion ? 0 : time / 620;
      const wave = fill > 0.01 && fill < 0.99 ? Math.sin(phase) * 1.3 : 0;
      // At 0 the liquid has zero area; at 1 the whole bowl is filled to its rim.
      fillRef.current?.setAttribute("d", `M50 ${surface} Q86 ${surface + wave} 121 ${surface} T190 ${surface} V${bowlBottom + 3} H50 Z`);
      streamRef.current?.setAttribute("d", `M123 140 C${124 + Math.sin(phase) * 0.8} 181 ${120 + Math.sin(phase * 0.8) * 1.2} ${surface - 30} 121 ${surface}`);
      rippleRef.current?.setAttribute("transform", `translate(121 ${surface}) scale(${1 + Math.sin(phase) * 0.14} 1)`);
      rippleRef.current?.setAttribute("opacity", fill > 0 && fill < 1 ? "1" : "0");
      overflowRef.current?.setAttribute("opacity", rawProgress > 1 ? "1" : "0");
      if (morphRef.current) {
        if (done) {
          morphRef.current.setAttribute("d", bottlePath);
          morphRef.current.style.opacity = "1";
          morphRef.current.style.fill = variant === "line" ? "white" : "black";
          if (!morphComplete.current) {
            morphComplete.current = true;
            setReady(true);
          }
        } else {
          const t = Math.max(0, (elapsed - 160) / 1490);
          morphRef.current.setAttribute("d", t < 0.45
            ? morphPath(from, blot, smooth(t / 0.45))
            : morphPath(blot, bottle, smooth((t - 0.45) / 0.55)));
          morphRef.current.style.fill = "black";
          morphRef.current.style.opacity = String(Math.min(1, elapsed / 480));
        }
      }
      frame = requestAnimationFrame(draw);
    }
    // Motion pauses while the tab is hidden; timestamps keep deadline progress accurate.
    const resume = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) frame = requestAnimationFrame(draw);
    };
    resume();
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [geometry, variant, reducedMotion, startedAt, deadline, bowlTop, bowlBottom]);

  if (!geometry) return null;
  const overflowing = progressOverride > 1;
  return createPortal(
    <div className={`deadline-wine wine-${variant}${contained ? " wine-contained" : ""}${ready ? " is-pouring" : " is-morphing"}${reducedMotion ? " reduce-motion" : ""}`}
      style={{ position: contained ? "absolute" : "fixed", left: geometry.left, top: geometry.top, width: 220 * geometry.scale, height: geometry.height }}>
      <svg className="wine-scene" viewBox={`0 0 220 ${height}`} fill="none" aria-hidden="true">
        <defs>
          <clipPath id={`${id}-bowl`}><path d={bowlPath} /></clipPath>
          <filter id={`${id}-rough`} x="-12%" y="-12%" width="124%" height="124%">
            <feTurbulence type="fractalNoise" baseFrequency="0.085" numOctaves="3" seed="8" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <pattern id={`${id}-hatch`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
            <path d="M0 0 V5" stroke="white" strokeWidth="0.65" />
          </pattern>
        </defs>
        <g transform="translate(-35 0)" filter={variant === "ink" ? `url(#${id}-rough)` : undefined}>
          <path ref={morphRef} className="wine-bottle" d={bottlePath} fill="black" stroke="black" strokeWidth={variant === "line" ? 1.3 : 1.8} strokeLinejoin="round" />
          <g className="wine-bottle-detail">
            {variant === "line" ? <>
              <path d="M33 29 L23 54 Q19 64 28 70 L80 105 M143 117 L155 125" stroke="black" strokeWidth="0.7" />
              <path d="M46 35 L92 72 L76 94 L29 62 Z" fill="white" stroke="black" />
              <path d="M45 49 L73 71 M42 55 L62 71" stroke="black" strokeWidth="0.7" />
            </> : variant === "ink" ? <>
              <path d="M47 33 L97 75 L78 97 L28 63 Z" fill="white" />
              <path d="M43 50 L77 77 M40 56 L70 80" stroke="black" strokeWidth="1.6" />
              <path d="M32 28 L23 55 M141 118 L153 126" stroke="white" strokeWidth="1.2" />
              <path d="M34 31 L101 84" stroke={`url(#${id}-hatch)`} strokeWidth="12" />
            </> : <>
              <path d="M47 33 L98 77 L78 99 L28 64 Z" fill="white" />
              <circle cx="62" cy="66" r="9" fill="black" />
              <path d="M143 115 L157 124" stroke="white" strokeWidth="2" />
            </>}
          </g>
        </g>
        <g className="wine-pour">
          <path ref={streamRef} className="wine-stream" stroke="black" strokeWidth={variant === "line" ? 1.15 : variant === "ink" ? 2.7 : 4} strokeLinecap="round" />
          <path className="wine-stream-glint" d={`M123 141 Q121 ${(bowlTop + 140) / 2} 121 ${bowlBottom}`} stroke="white" strokeWidth={variant === "cut" || variant === "hybrid" ? 1 : 0.45} strokeDasharray="2 58 7 97" />
        </g>
        <g className="wine-glass" filter={variant === "ink" ? `url(#${id}-rough)` : undefined}>
          <g clipPath={`url(#${id}-bowl)`}>
            <path ref={fillRef} fill="black" />
            {variant === "ink" && <path d={bowlPath} fill={`url(#${id}-hatch)`} />}
            {glassVariant === "line" && <path d={`M82 ${bowlTop + 12} C77 ${bowlTop + 60} 92 ${bowlBottom - 14} 103 ${bowlBottom - 12}`} stroke="white" strokeWidth="1.5" />}
            <ellipse ref={rippleRef} rx="10" ry="1.6" stroke="white" strokeWidth="0.7" />
          </g>
          <path d={bowlPath} stroke="black" strokeWidth={glassVariant === "line" ? 1.2 : glassVariant === "ink" ? 2 : 2.8} />
          {glassVariant === "line" && <ellipse cx="121" cy={bowlTop} rx="50" ry="3" stroke="black" strokeWidth="0.75" />}
          {variant === "ink" && <path d={`M68 ${bowlTop + 3} Q123 ${bowlTop + 8} 174 ${bowlTop} M124 ${bowlBottom} L123 ${height - 42} M86 ${height - 38} Q117 ${height - 47} 156 ${height - 39}`} stroke="black" strokeWidth="0.8" />}
          <path d={`M121 ${bowlBottom} V${height - 43} M88 ${height - 40} Q121 ${height - 47} 154 ${height - 40}`} stroke="black" strokeWidth={variant === "cut" ? 3 : 1.2} strokeLinecap="round" />
          {variant === "cut" && <path d={`M88 ${height - 43} H154 V${height - 39} H88 Z`} fill="black" />}
          <g ref={overflowRef} className="wine-overflow" opacity="0">
            <path d={`M${variant === "cut" ? 65 : 71} ${bowlTop} Q57 ${bowlTop + 17} 64 ${bowlTop + 50} T63 ${height - 51} M172 ${bowlTop} Q184 ${bowlTop + 30} 177 ${bowlTop + 53} T179 ${height - 46}`} stroke="black" strokeWidth={variant === "cut" ? 4 : 1.8} />
            <path className="wine-overflow-trace" d={`M63 ${bowlTop + 20} V${height - 49} M179 ${bowlTop + 10} V${height - 47}`} stroke="white" strokeWidth="0.8" strokeDasharray="4 32" />
            <ellipse cx="121" cy={height - 35} rx="78" ry={variant === "ink" ? 4 : 2} fill="black" />
          </g>
        </g>
      </svg>
      <button type="button" className="wine-close" onClick={onClose} aria-label="Restore deadline field" title="Restore deadline field (Esc)">×</button>
      <output className="sr-only">Deadline shown as a glass filling with ink. {overflowing ? "The deadline has passed." : "The glass fills as time elapses."} Press Escape to restore the time.</output>
    </div>, geometry.container || document.body);
}
