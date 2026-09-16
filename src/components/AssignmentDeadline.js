import { useCallback, useEffect, useRef, useState } from "react";
import { formatDateTime } from "../utils/timeFormatting";
import { formatTimeLeft } from "../utils/deadlines";
import DeadlineWine from "./DeadlineWine";
import LiquidDeadlineWine from "./LiquidDeadlineWine";

export default function AssignmentDeadline({ deadline, startedAt, variant, progressOverride, displayNow, contained = false, initiallyOpen = false }) {
  const [now, setNow] = useState(Date.now);
  const [open, setOpen] = useState(initiallyOpen);
  const anchor = useRef(null);
  const close = useCallback(() => {
    setOpen(false);
    anchor.current?.focus({ preventScroll: true });
  }, []);
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
    <span><time dateTime={deadline}>{formatDateTime(deadline)}</time><span aria-hidden="true"> / </span><span>{formatTimeLeft(deadline, displayNow ?? now)}</span></span>
  </>;
  // No direction is selected for the live UI. All three can be tried on the prototype route.
  if (!variant) return <div className="assignment-deadline">{contents}</div>;
  const Animation = variant === "liquid" ? LiquidDeadlineWine : DeadlineWine;
  return <>
    <button ref={anchor} type="button" className={`assignment-deadline deadline-wine-trigger${variant === "liquid" ? " liquid-trigger" : ""}${open ? " is-transformed" : ""}`}
      onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Deadline / Time left — pour time into a glass">
      <span className="deadline-field-text">{contents}</span>
    </button>
    {open && <Animation variant={variant} anchor={anchor} startedAt={startedAt} deadline={deadline} progressOverride={progressOverride} onClose={close} contained={contained} />}
  </>;
}
