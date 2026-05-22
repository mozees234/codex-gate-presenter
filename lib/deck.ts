// Helpers for parsing and preparing Claude Design HTML decks.

const RUNTIME_SRC = '/deck-stage-runtime.js';

// Matches <script src="deck-stage.js"></script> with optional ./ , quotes, spacing.
const DECK_STAGE_SCRIPT = /<script\b[^>]*\bsrc\s*=\s*["']\.?\/?deck-stage\.js["'][^>]*>\s*<\/script>/i;

/**
 * Prepare an uploaded deck for rendering: ensure our runtime script is present
 * in place of Claude Design's unbundled deck-stage.js.
 */
export function transformDeckHtml(raw: string): string {
  const runtimeTag = `<script src="${RUNTIME_SRC}"></script>`;

  if (DECK_STAGE_SCRIPT.test(raw)) {
    return raw.replace(DECK_STAGE_SCRIPT, runtimeTag);
  }

  // Already wired to our runtime? Leave it.
  if (raw.includes(RUNTIME_SRC)) return raw;

  // No deck-stage script tag found — inject before </body> (or append).
  if (/<\/body>/i.test(raw)) {
    return raw.replace(/<\/body>/i, `${runtimeTag}\n</body>`);
  }
  return raw + `\n${runtimeTag}\n`;
}

/** Pull a human title out of the deck HTML. */
export function extractTitle(raw: string): string {
  const t = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t && t[1].trim()) {
    return decodeEntities(t[1].trim());
  }
  const label = raw.match(/data-label\s*=\s*["']([^"']+)["']/i);
  if (label && label[1].trim()) {
    return label[1].replace(/^\d+\s*/, '').trim();
  }
  return 'Untitled deck';
}

/** Count top-level <section> slides (rough, for display only). */
export function countSlides(raw: string): number {
  const m = raw.match(/<section\b/gi);
  return m ? m.length : 0;
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'deck'
  );
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&middot;/g, '·')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}
