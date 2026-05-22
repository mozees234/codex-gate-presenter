# Codex Gate Presenter

Upload HTML decks exported from Claude Design, present them in the browser
(next/prev, fullscreen), edit them with a live preview, and share a permanent
link so anyone can view or present.

Claude Design exports reference an external `deck-stage.js` runtime that is **not
bundled** in the export — that's why a raw export can't be presented on its own.
This app supplies its own `deck-stage` runtime (`public/deck-stage-runtime.js`)
that scales each 1920×1080 `<section>` to fit the screen and handles navigation.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
```

With no `BLOB_READ_WRITE_TOKEN`, decks are stored locally under `.data/`.

## Routes

- `/` — deck library (upload, present, edit, delete)
- `/d/[slug]` — present mode (← → / Space / Home / End / F, click to advance)
- `/d/[slug]/edit` — code editor + live preview (⌘/Ctrl+S to save)
- `/raw/[slug]` — prepared deck HTML (used by the iframes)

## Deploy to Vercel

1. Push this folder to a Git repo and import it in Vercel (root = this folder).
2. In the Vercel project: **Storage → Create → Blob**, then connect it. Vercel
   injects `BLOB_READ_WRITE_TOKEN` automatically.
3. Deploy. Uploaded decks now persist and every `/d/[slug]` link is shareable.

## Updating a deck

Edit the HTML in the built-in editor (live preview), or re-upload a corrected
file from the library. Either way the existing share link keeps working.
