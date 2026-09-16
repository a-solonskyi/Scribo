export function localDeadlineToIso(value) {
  if (!value) return null;
  // datetime-local has no offset. Convert in the professor's browser, where
  // the correct local timezone (including daylight saving) is available.
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Deadline is invalid.");
  return date.toISOString();
}

export function normalizeDeadline(value) {
  if (!value) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new Error("Deadline must include a timezone. Please refresh and choose the deadline again.");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Deadline is invalid.");
  return date.toISOString();
}

export function formatTimeLeft(deadline, now = Date.now()) {
  const remaining = new Date(deadline).getTime() - now;
  if (!Number.isFinite(remaining)) return "Unavailable";
  if (remaining <= 0) return "Deadline passed";
  if (remaining < 60000) return "Less than a minute left";
  const totalMinutes = Math.floor(remaining / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return `${days ? `${days}d ` : ""}${days || hours ? `${hours}h ` : ""}${minutes}m left`;
}
