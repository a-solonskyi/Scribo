// Keep the existing acceptance limits and legacy payload shape. Error detail
// must not include student names, text, tokens or account identifiers.
export function validateDraftPayload({ draft, revision, baseRevision } = {}) {
  const issue = (field, code, message) => ({ field, code, error: `${message} Your browser copy has not been removed. Download a full backup before updating or leaving this page.` });
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return issue("draft", "invalid_draft", "The draft could not be read.");
  for (const [field, limit, label] of [["studentName", 180, "Student name"], ["essayText", 150000, "Essay text"], ["essayHtml", 500000, "Essay formatting"]]) {
    if (typeof draft[field] !== "string") return issue(field, "invalid_draft_field", `${label} has an unsupported format.`);
    if (draft[field].length > limit) return issue(field, "draft_field_too_large", `${label} exceeds the online save limit (${limit.toLocaleString("en-US")} characters).`);
  }
  for (const field of ["eventLog", "pasteEvents", "pasteOriginRanges", "pauseEvents"]) {
    if (!Array.isArray(draft[field])) return issue(field, "invalid_draft_field", `The draft's ${field === "eventLog" ? "writing history" : "writing metadata"} has an unsupported format.`);
  }
  if (!Number.isFinite(draft.startedAt)) return issue("startedAt", "invalid_draft_field", "The draft's start time has an unsupported format.");
  const validRevision = (value) => typeof value === "string" && /^[\w-]{16,80}$/.test(value);
  if (!validRevision(revision)) return issue("revision", "invalid_draft_revision", "This tab's save identifier is invalid.");
  if (!(baseRevision === null || validRevision(baseRevision))) return issue("baseRevision", "invalid_draft_revision", "This tab's previous save identifier is invalid.");
  return null;
}
