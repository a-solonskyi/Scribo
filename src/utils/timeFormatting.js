export function formatDuration(ms) {
  if (!ms || ms < 0) return "0s";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatDateTime(value) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
  }).format(value || 0);
}
