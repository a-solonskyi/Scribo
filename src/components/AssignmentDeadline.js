import { useEffect, useState } from "react";
import { formatDateTime } from "../utils/timeFormatting";
import { formatTimeLeft } from "../utils/deadlines";

export default function AssignmentDeadline({ deadline }) {
  const [now, setNow] = useState(Date.now);
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
  return <div className="assignment-deadline">
    <span className="deadline-label">Deadline / Time left</span>
    <div><time dateTime={deadline}>{formatDateTime(deadline)}</time><span aria-hidden="true"> / </span><span>{formatTimeLeft(deadline, now)}</span></div>
  </div>;
}
