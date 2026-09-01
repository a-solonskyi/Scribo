import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments } from "@/db/schema";
import { errorResponse } from "@/lib/server/data";

type Context = { params: Promise<{ publicToken: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { publicToken } = await params;
  const [row] = await getDb().select({
    id: assignments.id,
    topic: assignments.topic,
    instructions: assignments.instructions,
    deadline: assignments.deadline,
    publicToken: assignments.publicToken,
  }).from(assignments).where(eq(assignments.publicToken, publicToken)).limit(1);
  if (!row) return errorResponse("Essay link not found.", 404);
  return Response.json({
    id: row.id,
    topic: row.topic,
    instructions: row.instructions,
    deadline: row.deadline,
    public_token: row.publicToken,
  });
}
