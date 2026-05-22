import { NextRequest, NextResponse } from 'next/server';
import { getDeck, getDeckMeta, saveDeck, deleteDeck } from '@/lib/storage';
import { transformDeckHtml, countSlides } from '@/lib/deck';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const deck = await getDeck(params.id);
  if (!deck) {
    return NextResponse.json({ success: false, error: 'Deck not found.' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: deck });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const meta = await getDeckMeta(params.id);
  if (!meta) {
    return NextResponse.json({ success: false, error: 'Deck not found.' }, { status: 404 });
  }

  let body: { html?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const rawHtml = typeof body.html === 'string' ? body.html : undefined;
  const nextHtml = rawHtml !== undefined ? transformDeckHtml(rawHtml) : undefined;

  const updated = {
    ...meta,
    title: (body.title ?? meta.title).trim() || meta.title,
    slides: rawHtml !== undefined ? countSlides(rawHtml) : meta.slides,
    updatedAt: new Date().toISOString(),
  };

  // If no new HTML, re-load the stored HTML so saveDeck rewrites it intact.
  let htmlToStore = nextHtml;
  if (htmlToStore === undefined) {
    const existing = await getDeck(meta.id);
    htmlToStore = existing?.html ?? '';
  }

  const stored = await saveDeck(updated, htmlToStore);
  return NextResponse.json({ success: true, data: stored });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const ok = await deleteDeck(params.id);
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Deck not found.' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
