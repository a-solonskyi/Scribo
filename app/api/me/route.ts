import { NextResponse } from "next/server";
import { getProfessorContext } from "@/lib/server/professor";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getProfessorContext();
  if (!context) return NextResponse.json({ session: null });

  return NextResponse.json({
    session: {
      approved: context.approved,
      user: {
        id: context.user.userId,
        email: context.user.email,
        user_metadata: { full_name: context.user.fullName },
      },
    },
  });
}
