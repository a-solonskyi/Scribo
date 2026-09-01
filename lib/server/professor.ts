import { eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { approvedProfessors } from "@/db/schema";

export async function getProfessorContext() {
  const user = await getChatGPTUser();
  if (!user) return null;

  const [approval] = await getDb()
    .select()
    .from(approvedProfessors)
    .where(eq(approvedProfessors.userId, user.userId))
    .limit(1);

  return { user, approved: Boolean(approval) };
}

export async function requireApprovedProfessor() {
  const context = await getProfessorContext();
  if (!context?.approved) return null;
  return context.user;
}
