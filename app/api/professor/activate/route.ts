import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { approvedProfessors } from "@/db/schema";
import { readJsonObject, stringValue } from "@/lib/server/data";

const INVITATION_CODE_SHA256 = "3386ee21d0431bc969f932ce5fb9fb95fb3a46833ac29c737ba161ccae7e4f25";

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Sign in with ChatGPT first." }, { status: 401 });

  const body = await readJsonObject(request);
  if (await sha256(stringValue(body.invitationCode)) !== INVITATION_CODE_SHA256) {
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
