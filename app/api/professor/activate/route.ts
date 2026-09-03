import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { approvedProfessors } from "@/db/schema";
import { readJsonObject, stringValue } from "@/lib/server/data";
import { isValidInvitationCode } from "@/lib/server/invitation";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Sign in with ChatGPT first." }, { status: 401 });

  const body = await readJsonObject(request);
  if (!(await isValidInvitationCode(stringValue(body.invitationCode)))) {
    return NextResponse.json({ error: "Invalid invitation code." }, { status: 403 });
  }

  const db = getDb();
  const [existing] = await db.select().from(approvedProfessors)
    .where(eq(approvedProfessors.userId, user.userId)).limit(1);

  if (!existing) {
    await db.insert(approvedProfessors).values({
      userId: user.userId,
      email: user.email,
      displayName: user.fullName,
      createdAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true });
}
