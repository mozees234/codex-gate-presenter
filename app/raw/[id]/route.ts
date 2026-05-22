import { NextRequest, NextResponse } from 'next/server';
import { getDeck } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Serves a deck's prepared HTML for embedding in an <iframe src>.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const deck = await getDeck(params.id);
  if (!deck) {
    return new NextResponse('Deck not found', { status: 404 });
  }
  return new NextResponse(deck.html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
