import { useCallback, useEffect, useRef, useState } from "react";
import { formatDateTime } from "../utils/timeFormatting";
import { formatTimeLeft } from "../utils/deadlines";
import "./assignment-deadline.css";

export default function AssignmentDeadline({ deadline, startedAt, variant, progressOverride, displayNow, contained = false, initiallyOpen = false, motionRate = 1 }) {
  const [now, setNow] = useState(Date.now);
  const [open, setOpen] = useState(initiallyOpen);
  const [loaded, setLoaded] = useState(null);
  const [loadError, setLoadError] = useState("");
  const anchor = useRef(null);
  const isLiquid = variant === "liquid" || variant === "liquid-previous";
  const kind = isLiquid ? "liquid" : "original";
  const Animation = loaded?.kind === kind ? loaded.Component : null;
  const close = useCallback(() => {
    setOpen(false);
    anchor.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (!open || !variant || Animation) return;
    let cancelled = false;
    // Keep both the renderer and its styles out of the initial page load.
    const module = isLiquid ? import("./LiquidDeadlineWine") : import("./DeadlineWine");
    module.then(({ default: Component }) => {
      if (!cancelled) setLoaded({ kind, Component });
    }).catch(() => {
      if (!cancelled) {
        setOpen(false);
        setLoadError("The animation couldn’t load. Click the deadline to try again.");
      }
    });
    return () => { cancelled = true; };
  }, [open, variant, isLiquid, kind, Animation]);
  useEffect(() => {
    if (!deadline) return;
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 15000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [deadline]);

  if (!deadline || Number.isNaN(new Date(deadline).getTime())) return null;
  const contents = <>
    <span className="deadline-label">Deadline / Time left</span>
    <time className="deadline-date" dateTime={deadline}>{formatDateTime(deadline)}</time>
    <span className="deadline-time-left">{formatTimeLeft(deadline, displayNow ?? now)}</span>
  </>;
  if (!variant) return <div className="assignment-deadline">{contents}</div>;
  return <>
    <button ref={anchor} type="button" className={`assignment-deadline deadline-wine-trigger${isLiquid ? " liquid-trigger" : ""}${open && Animation ? " is-transformed" : ""}`}
      onClick={() => { setLoadError(""); setOpen((value) => !value); }} aria-expanded={open && !!Animation} aria-busy={open && !Animation}>
      <span className="deadline-field-text">{contents}</span>
    </button>
    {loadError && <span role="status" className="deadline-load-error">{loadError}</span>}
    {open && Animation && <Animation variant={variant} anchor={anchor} startedAt={startedAt} deadline={deadline} progressOverride={progressOverride} onClose={close} contained={contained} motionRate={motionRate} />}
  </>;
}
