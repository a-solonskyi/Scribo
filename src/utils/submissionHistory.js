import { encodeDraft, decodeDraft } from "./draftEncoding.js";
import { validateWritingHistory } from "./writingHistory.js";

const PREFIX = "writing-history-v1:";
export const MAX_SUBMISSION_BYTES = 16_000_000;
export const MAX_STORED_SUBMISSION_BYTES = 1_500_000;

export async function readSubmissionJson(request, maxBytes = MAX_SUBMISSION_BYTES) {
  const reader = request.body?.getReader();
  if (!reader) throw Object.assign(new Error("A submission is required."), { status: 400 });
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw Object.assign(new Error("This submission is too large. Your draft has been kept; download a copy and contact your professor."), { status: 413 });
    }
    chunks.push(value);
  }
  try {
    const value = JSON.parse(await new Blob(chunks).text());
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw Object.assign(new Error("Invalid submission."), { status: 400 }); }
}

export async function encodeSubmissionHistory(events) {
  return PREFIX + await encodeDraft(events);
}

export async function decodeSubmissionHistory(value) {
  const events = value.startsWith(PREFIX)
    ? await decodeDraft(value.slice(PREFIX.length))
    : JSON.parse(value);
  if (!Array.isArray(events)) throw new Error("invalid_history");
  return events;
}

// Both submission paths preserve the evidence even when validation fails.
export async function prepareSubmissionHistory(events, finalText) {
  const integrity = validateWritingHistory(events, finalText);
  return { encoded: await encodeSubmissionHistory(events), integrity };
}

export function assertSubmissionFits(values, maxBytes = MAX_STORED_SUBMISSION_BYTES) {
  const bytes = new TextEncoder().encode(values.join("")).byteLength;
  if (bytes > maxBytes) {
    throw Object.assign(new Error("This essay’s writing history is too large to submit. Your draft is still available; download a copy and contact your professor."), { status: 413 });
  }
}
