import { NextRequest, NextResponse } from 'next/server';
import { listDecks, saveDeck, getDeckMeta, type DeckMeta } from '@/lib/storage';
import { transformDeckHtml, extractTitle, countSlides, slugify } from '@/lib/deck';
import { newId } from '@/lib/ids';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const decks = await listDecks();
  return NextResponse.json({ success: true, data: decks });
}

export async function POST(req: NextRequest) {
  let rawHtml = '';
  let title = '';

  const contentType = req.headers.get('content-type') || '';
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      title = (form.get('title') as string) || '';
      if (file && typeof file !== 'string') {
        rawHtml = await file.text();
      }
    } else {
      const body = await req.json();
      rawHtml = body.html || '';
      title = body.title || '';
    }
  } catch {
    return NextResponse.json({ success: false, error: 'Could not read upload.' }, { status: 400 });
  }

  if (!rawHtml.trim()) {
    return NextResponse.json({ success: false, error: 'No HTML content provided.' }, { status: 400 });
  }

  const html = transformDeckHtml(rawHtml);
  const finalTitle = (title || extractTitle(rawHtml)).trim() || 'Untitled deck';

  const id = newId();
  const slug = await uniqueSlug(slugify(finalTitle));
  const now = new Date().toISOString();

  const meta: DeckMeta = {
    id,
    slug,
    title: finalTitle,
    slides: countSlides(rawHtml),
    createdAt: now,
    updatedAt: now,
  };

  try {
    const stored = await saveDeck(meta, html);
    return NextResponse.json({ success: true, data: stored }, { status: 201 });
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Unknown storage error.';
    const hint = !process.env.BLOB_READ_WRITE_TOKEN
      ? ' Storage is not configured — connect a Vercel Blob store to this project (Storage → Blob → Connect), then redeploy.'
      : '';
    return NextResponse.json(
      { success: false, error: `Could not save deck.${hint}`, detail },
      { status: 500 }
    );
  }
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let n = 1;
  // getDeckMeta resolves by id OR slug, so this also avoids slug collisions.
  while (await getDeckMeta(candidate)) {
    candidate = `${base}-${++n}`;
  }
  return candidate;
}
