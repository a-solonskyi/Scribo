export async function getCurrentSession() {
  const response = await fetch("/api/me", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to check professor access.");
  const data = await response.json();
  return data.session;
}

export function onAuthChange() {
  return () => {};
}

export function signOutProfessor() {
  window.location.assign("/signout-with-chatgpt?return_to=/login");
}

export async function activateProfessor(invitationCode) {
  const response = await fetch("/api/professor/activate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invitationCode }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Unable to activate professor access.");
}
