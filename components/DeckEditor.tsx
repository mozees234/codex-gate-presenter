'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { html as htmlLang } from '@codemirror/lang-html';
import { transformDeckHtml } from '@/lib/deck';

// CodeMirror touches the DOM — load client-side only.
const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false });

interface DeckEditorProps {
  id: string;
  initialTitle: string;
  initialHtml: string;
}

type Status = 'saved' | 'dirty' | 'saving' | 'error';

export default function DeckEditor({ id, initialTitle, initialHtml }: DeckEditorProps) {
  const [code, setCode] = useState(initialHtml);
  const [title, setTitle] = useState(initialTitle);
  const [previewHtml, setPreviewHtml] = useState(() => transformDeckHtml(initialHtml));
  const [status, setStatus] = useState<Status>('saved');
  const [slide, setSlide] = useState({ index: 0, total: 0 });

  const previewRef = useRef<HTMLIFrameElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extensions = useMemo(() => [htmlLang()], []);

  // Debounced live preview.
  const onChange = useCallback((value: string) => {
    setCode(value);
    setStatus('dirty');
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setPreviewHtml(transformDeckHtml(value));
    }, 550);
  }, []);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data || {};
      if (d.type === 'deck:state') setSlide({ index: d.index, total: d.total });
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (status === 'dirty' || status === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [status]);

  const save = useCallback(async () => {
    setStatus('saving');
    try {
      const res = await fetch(`/api/decks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: code, title }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Save failed');
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }, [id, code, title]);

  // Cmd/Ctrl+S to save.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const send = useCallback((cmd: string) => {
    previewRef.current?.contentWindow?.postMessage({ type: 'deck:cmd', cmd }, '*');
  }, []);

  const statusText: Record<Status, string> = {
    saved: 'All changes saved',
    dirty: 'Unsaved changes',
    saving: 'Saving…',
    error: 'Save failed',
  };

  return (
    <div className="editor-root">
      <div className="editor-head">
        <div className="left">
          <Link href="/" className="btn ghost sm">
            ← Library
          </Link>
          <input
            className="title-input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setStatus('dirty');
            }}
            placeholder="Deck title"
          />
        </div>
        <div className="right">
          <span className="status">{statusText[status]}</span>
          <Link href={`/d/${id}`} className="btn ghost sm">
            Present
          </Link>
          <button className="btn sm" onClick={save} disabled={status === 'saving'}>
            {status === 'saving' ? <span className="spinner" /> : 'Save'}
          </button>
        </div>
      </div>

      <div className="editor-pane">
        <CodeMirror
          value={code}
          height="100%"
          theme="dark"
          extensions={extensions}
          onChange={onChange}
          basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
        />
      </div>

      <div className="preview-pane">
        <iframe
          ref={previewRef}
          title="Live preview"
          srcDoc={previewHtml}
          onLoad={() => send('report')}
        />
        <div className="preview-nav">
          <button onClick={() => send('prev')} title="Previous">‹</button>
          <span className="counter">{slide.total ? `${slide.index + 1} / ${slide.total}` : '–'}</span>
          <button onClick={() => send('next')} title="Next">›</button>
        </div>
      </div>
    </div>
  );
}
