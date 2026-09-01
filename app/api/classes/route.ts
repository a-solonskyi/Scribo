import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { classes } from "@/db/schema";
import { errorResponse, readJsonObject, serializeClass, stringValue } from "@/lib/server/data";
import { requireApprovedProfessor } from "@/lib/server/professor";

export async function GET() {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse("Professor access required.", 401);
  const rows = await getDb().select().from(classes)
    .where(eq(classes.professorId, professor.userId)).orderBy(desc(classes.createdAt));
  return Response.json(rows.map(serializeClass));
}

export async function POST(request: Request) {
  const professor = await requireApprovedProfessor();
  if (!professor) return errorResponse("Professor access required.", 401);
  const body = await readJsonObject(request);
  const name = stringValue(body.name).trim();
  if (!name) return errorResponse("Class name is required.");

  const row = {
    id: crypto.randomUUID(),
    professorId: professor.userId,
    name: name.slice(0, 180),
    description: stringValue(body.description).trim().slice(0, 1000) || null,
    createdAt: new Date().toISOString(),
  };
  await getDb().insert(classes).values(row);
  return Response.json(serializeClass(row), { status: 201 });
}
