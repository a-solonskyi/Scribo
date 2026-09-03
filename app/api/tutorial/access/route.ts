import { NextResponse } from "next/server";
import { readJsonObject, stringValue } from "@/lib/server/data";
import { isValidInvitationCode } from "@/lib/server/invitation";

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!(await isValidInvitationCode(stringValue(body.invitationCode)))) {
    return NextResponse.json({ error: "Invalid invitation code." }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
