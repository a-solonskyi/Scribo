const INVITATION_CODE_SHA256 =
  "3386ee21d0431bc969f932ce5fb9fb95fb3a46833ac29c737ba161ccae7e4f25";

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function isValidInvitationCode(value: string) {
  return (await sha256(value)) === INVITATION_CODE_SHA256;
}
