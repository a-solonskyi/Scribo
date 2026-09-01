async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

export async function getProfile() {
  const data = await request("/api/me", { cache: "no-store" });
  return data.session?.user || null;
}

export async function getClasses() {
  return request("/api/classes", { cache: "no-store" });
}

export async function createClass(payload) {
  return request("/api/classes", { method: "POST", body: JSON.stringify(payload) });
}

export async function deleteClass(classId) {
  await request(`/api/classes/${classId}`, { method: "DELETE" });
}

export async function getClass(classId) {
  return request(`/api/classes/${classId}`, { cache: "no-store" });
}

export async function getAssignmentsForClass(classId) {
  return request(`/api/classes/${classId}/assignments`, { cache: "no-store" });
}

export async function createAssignment(payload) {
  return request(`/api/classes/${payload.classId}/assignments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteAssignment(assignmentId) {
  await request(`/api/assignments/${assignmentId}`, { method: "DELETE" });
}

export async function getAssignment(assignmentId) {
  return request(`/api/assignments/${assignmentId}`, { cache: "no-store" });
}

export async function getAssignmentByPublicToken(publicToken) {
  return request(`/api/write/${publicToken}`, { cache: "no-store" });
}

export async function getSubmissionsForAssignment(assignmentId) {
  return request(`/api/assignments/${assignmentId}/submissions`, { cache: "no-store" });
}

export async function createSubmission(payload) {
  await request("/api/submissions", { method: "POST", body: JSON.stringify(payload) });
}

export async function deleteSubmission(submissionId) {
  await request(`/api/submissions/${submissionId}`, { method: "DELETE" });
}

export async function getSubmission(submissionId) {
  return request(`/api/submissions/${submissionId}`, { cache: "no-store" });
}

export async function getResponseAnnotations(submissionId) {
  return request(`/api/submissions/${submissionId}/annotations`, { cache: "no-store" });
}

export async function createResponseAnnotation(payload) {
  return request(`/api/submissions/${payload.submission_id}/annotations`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateResponseAnnotation(annotationId, patch) {
  return request(`/api/annotations/${annotationId}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function deleteResponseAnnotation(annotationId) {
  await request(`/api/annotations/${annotationId}`, { method: "DELETE" });
}

export async function deleteResponseAnnotations(annotationIds) {
  if (!annotationIds.length) return;
  await request("/api/annotations/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ annotationIds }),
  });
}
