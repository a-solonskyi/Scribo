import { NextResponse } from 'next/server';
import { requireApprovedProfessor } from '@/lib/server/professor';
import { instructionsContent } from '@/lib/server/instructions-content';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  if (!(await requireApprovedProfessor())) {
    return NextResponse.json(
      { error: 'Professor access required.' },
      { status: 403, headers },
    );
  }

  return NextResponse.json(instructionsContent, { headers });
}
