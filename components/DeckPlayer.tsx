'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface DeckPlayerProps {
  id: string;
  title: string;
}

interface DeckState {
  index: number;
  total: number;
}

export default function DeckPlayer({ id, title }: DeckPlayerProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<DeckState>({ index: 0, total: 0 });
  const [chromeVisible, setChromeVisible] = useState(true);
  const [copied, setCopied] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback((cmd: string, extra: Record<string, unknown> = {}) => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'deck:cmd', cmd, ...extra }, '*');
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) rootRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  }, []);

  // Receive slide state from the deck runtime.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data || {};
      if (d.type === 'deck:state') {
        setState({ index: d.index, total: d.total });
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Auto-hide the chrome during presentation.
  const poke = useCallback(() => {
    setChromeVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChromeVisible(false), 2600);
  }, []);

  // Mirror keyboard here too, so it works even before the iframe has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        router.push('/');
        return;
      }
      if (['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'f', 'F'].includes(e.key)) {
        poke(); // any key press reveals the controls briefly
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') send('next');
        else if (e.key === 'ArrowLeft' || e.key === 'PageUp') send('prev');
        else if (e.key === 'Home') send('first');
        else if (e.key === 'End') send('last');
        else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [send, toggleFullscreen, router, poke]);

  useEffect(() => {
    poke();
    window.addEventListener('mousemove', poke);
    return () => {
      window.removeEventListener('mousemove', poke);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [poke]);

  const onLoad = useCallback(() => {
    send('setPresent', { on: true });
    send('report');
  }, [send]);

  const share = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  }, []);

  return (
    <div className="player-root" ref={rootRef}>
      <iframe
        ref={iframeRef}
        className="player-iframe"
        src={`/raw/${id}`}
        title={title}
        onLoad={onLoad}
        allow="fullscreen"
      />

      <div className={`player-back${chromeVisible ? '' : ' hidden'}`}>
        <Link href="/" className="btn ghost sm" title="Back to library">
          ← Library
        </Link>
        <button className="btn ghost sm" onClick={share} title="Copy share link">
          {copied ? 'Link copied' : 'Share'}
        </button>
      </div>

      <div className={`player-bar${chromeVisible ? '' : ' hidden'}`} onMouseEnter={poke}>
        <button onClick={() => send('first')} title="First slide">⏮</button>
        <button onClick={() => send('prev')} title="Previous (←)">‹</button>
        <span className="counter">
          {state.total ? `${state.index + 1} / ${state.total}` : '–'}
        </span>
        <button onClick={() => send('next')} title="Next (→)">›</button>
        <button onClick={() => send('last')} title="Last slide">⏭</button>
        <span className="divider" />
        <button onClick={toggleFullscreen} title="Fullscreen (F)">⛶</button>
      </div>
    </div>
  );
}
