const FORMAT = "skribo-draft-recovery";

async function checksum(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Snapshot before awaiting: typing during the download cannot change its bytes.
// This export does not change browser storage, acknowledge a save, or submit.
export async function encodeDraftRecovery({ assignment, draft, userId = null, saveState = null }) {
  const payload = JSON.stringify({
    exportedAt: new Date().toISOString(),
    assignment: { id: assignment?.id, publicToken: assignment?.public_token, topic: assignment?.topic },
    userId, draft, saveState,
  });
  return JSON.stringify({ format: FORMAT, version: 1, sha256: await checksum(payload), payload });
}

// Verification only. Deliberately never imports over an account/browser draft.
export async function decodeDraftRecovery(file) {
  const envelope = JSON.parse(file);
  if (envelope?.format !== FORMAT || envelope.version !== 1 || typeof envelope.payload !== "string" ||
      await checksum(envelope.payload) !== envelope.sha256) throw new Error("The full backup is invalid or damaged.");
  return JSON.parse(envelope.payload);
}

export async function downloadDraftRecovery(options) {
  const content = await encodeDraftRecovery(options);
  const name = (options.assignment?.topic || "essay").replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 80) || "essay";
  const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}-full-backup.skribo.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
