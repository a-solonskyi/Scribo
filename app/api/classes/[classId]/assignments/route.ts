import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments, submissions } from "@/db/schema";
import { errorResponse, getOwnedClass, readJsonObject, serializeAssignment, stringValue } from "@/lib/server/data";
import { requireApprovedProfessor } from "@/lib/server/professor";
import { normalizeDeadline } from "@/src/utils/deadlines";
import { normalizeInstructions } from "@/src/utils/assignmentInstructions";

type Context = { params: Promise<{ classId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse("Professor access required.", 401);
  const { classId } = await params;
  if (!(await getOwnedClass(professor.userId, classId))) return errorResponse("Class not found.", 404);

  const rows = await getDb()
    .select({ assignment: assignments, submissionCount: sql<number>`count(${submissions.id})` })
    .from(assignments)
    .leftJoin(submissions, eq(assignments.id, submissions.assignmentId))
    .where(and(eq(assignments.classId, classId), eq(assignments.professorId, professor.userId)))
    .groupBy(assignments.id)
    .orderBy(desc(assignments.createdAt));

  return Response.json(rows.map(({ assignment, submissionCount }) => ({
    ...serializeAssignment(assignment),
    submissions: Array.from({ length: Number(submissionCount) }, (_, index) => ({ id: String(index) })),
  })));
}

export async function POST(request: Request, { params }: Context) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse("Professor access required.", 401);
  const { classId } = await params;
  if (!(await getOwnedClass(professor.userId, classId))) return errorResponse("Class not found.", 404);

  const body = await readJsonObject(request);
  const topic = stringValue(body.topic).trim();
  if (!topic) return errorResponse("Essay topic is required.");
  let deadline: string | null;
  let instructions: string | null;
  try {
    deadline = normalizeDeadline(body.deadline);
    instructions = normalizeInstructions(body.instructions);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Essay details are invalid.");
  }

  const row = {
    id: crypto.randomUUID(),
    classId,
    professorId: professor.userId,
    topic: topic.slice(0, 240),
    instructions,
    publicToken: crypto.randomUUID().replaceAll("-", "").slice(0, 16),
    deadline,
    createdAt: new Date().toISOString(),
  };
  await getDb().insert(assignments).values(row);
  return Response.json(serializeAssignment(row), { status: 201 });
}
