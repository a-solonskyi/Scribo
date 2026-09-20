// Compatibility for old callers. Position-dependent operations cannot be
// sampled or trimmed; submissionHistory handles lossless storage compression.
export function trimEventLog(eventLog) {
  return eventLog;
}
