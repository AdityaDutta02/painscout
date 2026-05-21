import { NextRequest, NextResponse } from 'next/server';
import { dbGet } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const embedToken = req.headers.get('x-embed-token') ?? '';
  if (!embedToken) return NextResponse.json({ error: 'Missing embed token' }, { status: 401 });
  try {
    const row = await dbGet('analyses', params.id, embedToken);
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
