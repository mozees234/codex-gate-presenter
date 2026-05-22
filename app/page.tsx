'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { DeckMeta } from '@/lib/storage';

export default function LibraryPage() {
  const [decks, setDecks] = useState<DeckMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/decks', { cache: 'no-store' });
    const json = await res.json();
    setDecks(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upload = useCallback(
    async (file: File) => {
      setError('');
      if (!/\.html?$/i.test(file.name)) {
        setError('Please upload an .html file exported from Claude Design.');
        return;
      }
      setUploading(true);
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/decks', { method: 'POST', body: form });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Upload failed.');
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed.');
      } finally {
        setUploading(false);
      }
    },
    [load]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) upload(file);
    },
    [upload]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!confirm('Delete this deck? This cannot be undone.')) return;
      await fetch(`/api/decks/${id}`, { method: 'DELETE' });
      await load();
    },
    [load]
  );

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <span className="glyph">CG</span>
          <div>
            <div className="name">Codex Gate Presenter</div>
            <div className="sub">Upload · Present · Share</div>
          </div>
        </div>
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <span className="spinner" /> : '＋'} Upload deck
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".html,text/html"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = '';
          }}
        />
      </div>

      <div
        className={`dropzone${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <h2>Drop a Claude Design HTML deck here</h2>
        <p className="hint">
          It becomes a shareable presenter link instantly. Re-upload or edit anytime to update it.
        </p>
      </div>

      {error && <div className="toast">{error}</div>}

      {loading ? (
        <div className="empty">
          <span className="spinner" /> Loading decks…
        </div>
      ) : decks.length === 0 ? (
        <div className="empty">No decks yet. Drop your first HTML deck above to get started.</div>
      ) : (
        <div className="grid">
          {decks.map((d) => (
            <DeckCard key={d.id} deck={d} onDelete={() => remove(d.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function DeckCard({ deck, onDelete }: { deck: DeckMeta; onDelete: () => void }) {
  return (
    <div className="card-deck">
      <Link href={`/d/${deck.slug}`} className="thumb" aria-label={`Present ${deck.title}`}>
        <Thumb id={deck.slug} />
      </Link>
      <div className="meta">
        <h3>{deck.title}</h3>
        <div className="small">
          {deck.slides} slides · updated {new Date(deck.updatedAt).toLocaleDateString()}
        </div>
      </div>
      <div className="actions">
        <Link href={`/d/${deck.slug}`} className="btn sm">
          Present
        </Link>
        <button className="btn danger sm" onClick={onDelete} style={{ marginLeft: 'auto' }}>
          Delete
        </button>
      </div>
    </div>
  );
}

// Live mini-preview of slide 1, scaled into the 16:9 thumb.
function Thumb({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.156);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setScale(el.clientWidth / 1920);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      <iframe
        src={`/raw/${id}`}
        title="preview"
        scrolling="no"
        style={{ transform: `scale(${scale})` }}
        tabIndex={-1}
      />
    </div>
  );
}
