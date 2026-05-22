/*
 * Codex Gate Presenter — deck-stage runtime
 * Drop-in replacement for Claude Design's (unbundled) deck-stage.js.
 *
 * Renders a <deck-stage width height> as a single-slide-at-a-time player:
 *  - scales the fixed canvas (default 1920x1080) to fit the viewport (letterboxed)
 *  - shows one <section> slide at a time
 *  - keyboard nav (arrows / space / PageUp-Down / Home / End / F)
 *  - postMessage protocol so the surrounding app chrome can drive it
 *
 * Parent -> iframe:  { type: 'deck:cmd', cmd: 'next'|'prev'|'first'|'last'|'fullscreen', index?, on? }
 *                    cmd 'goto' uses `index`; cmd 'setPresent' uses `on`
 * iframe -> parent:  { type: 'deck:state', index, total, label }
 */
(function () {
  if (window.customElements && customElements.get('deck-stage')) return;

  class DeckStage extends HTMLElement {
    connectedCallback() {
      // Children may not be parsed yet when the element's start tag is seen.
      if (this._booted) return;
      if (this.querySelector(':scope > section')) {
        this.boot();
      } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.boot(), { once: true });
      } else {
        // Defer one tick so remaining children get parsed.
        requestAnimationFrame(() => this.boot());
      }
    }

    boot() {
      if (this._booted) return;
      this._booted = true;

      this.W = parseInt(this.getAttribute('width'), 10) || 1920;
      this.H = parseInt(this.getAttribute('height'), 10) || 1080;
      this.slides = Array.from(this.querySelectorAll(':scope > section'));
      if (!this.slides.length) return;
      this.index = 0;
      this.present = false;

      Object.assign(this.style, {
        position: 'fixed',
        inset: '0',
        display: 'block',
        overflow: 'hidden',
      });

      // A scaled stage that holds every slide stacked on top of each other.
      this.stage = document.createElement('div');
      Object.assign(this.stage.style, {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: this.W + 'px',
        height: this.H + 'px',
        transformOrigin: 'center center',
      });

      this.slides.forEach((s) => {
        Object.assign(s.style, {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          margin: '0',
        });
        this.stage.appendChild(s);
      });
      this.appendChild(this.stage);

      this.rescale();
      this.show(0);

      this._onResize = () => this.rescale();
      this._onKey = (e) => this.onKey(e);
      this._onMsg = (e) => this.onMessage(e);
      this._onClick = (e) => this.onClick(e);
      window.addEventListener('resize', this._onResize);
      window.addEventListener('keydown', this._onKey);
      window.addEventListener('message', this._onMsg);
      this.addEventListener('click', this._onClick);

      // Report now and a couple more times — the parent frame may attach its
      // listener slightly after the iframe finishes loading (hydration race).
      this.report();
      setTimeout(() => this.report(), 150);
      setTimeout(() => this.report(), 500);
    }

    rescale() {
      const scale = Math.min(window.innerWidth / this.W, window.innerHeight / this.H);
      this.stage.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
    }

    show(i) {
      const n = this.slides.length;
      this.index = Math.max(0, Math.min(n - 1, i));
      this.slides.forEach((s, idx) => {
        s.style.display = idx === this.index ? '' : 'none';
      });
      this.report();
    }

    next() { this.show(this.index + 1); }
    prev() { this.show(this.index - 1); }

    onKey(e) {
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          this.next(); e.preventDefault(); break;
        case 'ArrowLeft':
        case 'PageUp':
          this.prev(); e.preventDefault(); break;
        case 'Home':
          this.show(0); e.preventDefault(); break;
        case 'End':
          this.show(this.slides.length - 1); e.preventDefault(); break;
        case 'f':
        case 'F':
          this.toggleFullscreen(); break;
        default:
          break;
      }
    }

    onClick(e) {
      if (!this.present) return;
      if (e.target.closest('a, button, input, textarea, select')) return;
      // Left third = back, rest = forward.
      if (e.clientX < window.innerWidth / 3) this.prev();
      else this.next();
    }

    onMessage(e) {
      const d = e.data || {};
      if (d.type !== 'deck:cmd') return;
      switch (d.cmd) {
        case 'next': this.next(); break;
        case 'prev': this.prev(); break;
        case 'first': this.show(0); break;
        case 'last': this.show(this.slides.length - 1); break;
        case 'goto': this.show(d.index | 0); break;
        case 'fullscreen': this.toggleFullscreen(); break;
        case 'setPresent': this.present = !!d.on; break;
        case 'report': this.report(); break;
        default: break;
      }
    }

    toggleFullscreen() {
      const el = document.documentElement;
      if (!document.fullscreenElement) {
        (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el);
      } else {
        (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
      }
    }

    report() {
      const slide = this.slides[this.index];
      const label = slide ? slide.getAttribute('data-label') || '' : '';
      try {
        window.parent.postMessage(
          { type: 'deck:state', index: this.index, total: this.slides.length, label: label },
          '*'
        );
      } catch (_) { /* no parent */ }
    }
  }

  customElements.define('deck-stage', DeckStage);
})();
