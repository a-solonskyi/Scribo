// Keep the raw ratio: values above one are needed to distinguish full from overflow.
export function deadlineProgress(startedAt, deadline, now = Date.now()) {
  if (startedAt == null || deadline == null || !Number.isFinite(now)) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(deadline).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.max(0, (now - start) / (end - start));
}

export function deadlineFill(progress) {
  return Math.min(1, Math.max(0, progress ?? 0));
}
