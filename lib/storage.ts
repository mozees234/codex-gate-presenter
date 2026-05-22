// Deck storage with two backends:
//   - Vercel Blob   (when BLOB_READ_WRITE_TOKEN is set — i.e. on Vercel)
//   - Local files   (.data/ — used in local dev with no cloud setup)
//
// A single index.json holds all deck metadata; each deck's HTML is stored
// separately so big decks don't bloat the index.

import { promises as fs } from 'fs';
import path from 'path';

export interface DeckMeta {
  id: string;
  slug: string;
  title: string;
  slides: number;
  createdAt: string;
  updatedAt: string;
  htmlUrl?: string; // Blob backend only
}

export interface Deck {
  meta: DeckMeta;
  html: string;
}

const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

const INDEX_KEY = 'codexgate/index.json';
const deckKey = (id: string) => `codexgate/decks/${id}.html`;

const DATA_DIR = path.join(process.cwd(), '.data');
const localIndexPath = path.join(DATA_DIR, 'index.json');
const localDeckPath = (id: string) => path.join(DATA_DIR, 'decks', `${id}.html`);

// ---------------------------------------------------------------- index

async function readIndex(): Promise<DeckMeta[]> {
  if (useBlob) {
    const { list } = await import('@vercel/blob');
    const { blobs } = await list({ prefix: INDEX_KEY });
    const found = blobs.find((b) => b.pathname === INDEX_KEY);
    if (!found) return [];
    const res = await fetch(`${found.url}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return (await res.json()) as DeckMeta[];
  }

  try {
    const raw = await fs.readFile(localIndexPath, 'utf8');
    return JSON.parse(raw) as DeckMeta[];
  } catch {
    return [];
  }
}

async function writeIndex(index: DeckMeta[]): Promise<void> {
  const body = JSON.stringify(index, null, 2);
  if (useBlob) {
    const { put } = await import('@vercel/blob');
    await put(INDEX_KEY, body, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(localIndexPath, body, 'utf8');
}

// ---------------------------------------------------------------- public API

export async function listDecks(): Promise<DeckMeta[]> {
  const index = await readIndex();
  return [...index].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getDeckMeta(id: string): Promise<DeckMeta | null> {
  const index = await readIndex();
  return index.find((d) => d.id === id || d.slug === id) ?? null;
}

export async function getDeck(id: string): Promise<Deck | null> {
  const meta = await getDeckMeta(id);
  if (!meta) return null;

  if (useBlob) {
    if (!meta.htmlUrl) return null;
    const res = await fetch(`${meta.htmlUrl}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return { meta, html: await res.text() };
  }

  try {
    const html = await fs.readFile(localDeckPath(meta.id), 'utf8');
    return { meta, html };
  } catch {
    return null;
  }
}

export async function saveDeck(meta: DeckMeta, html: string): Promise<DeckMeta> {
  let stored: DeckMeta = { ...meta };

  if (useBlob) {
    const { put } = await import('@vercel/blob');
    const blob = await put(deckKey(meta.id), html, {
      access: 'public',
      contentType: 'text/html; charset=utf-8',
      addRandomSuffix: false,
    });
    stored.htmlUrl = blob.url;
  } else {
    await fs.mkdir(path.join(DATA_DIR, 'decks'), { recursive: true });
    await fs.writeFile(localDeckPath(meta.id), html, 'utf8');
  }

  const index = await readIndex();
  const i = index.findIndex((d) => d.id === meta.id);
  if (i >= 0) index[i] = stored;
  else index.push(stored);
  await writeIndex(index);

  return stored;
}

export async function deleteDeck(id: string): Promise<boolean> {
  const index = await readIndex();
  const meta = index.find((d) => d.id === id || d.slug === id);
  if (!meta) return false;

  if (useBlob) {
    const { del } = await import('@vercel/blob');
    if (meta.htmlUrl) {
      try { await del(meta.htmlUrl); } catch { /* already gone */ }
    }
  } else {
    try { await fs.unlink(localDeckPath(meta.id)); } catch { /* already gone */ }
  }

  await writeIndex(index.filter((d) => d.id !== meta.id));
  return true;
}
