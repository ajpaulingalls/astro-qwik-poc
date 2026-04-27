// Idempotent client-side script injection for third-party embed providers
// (Twitter widgets.js, Instagram embed.js, Brightcove per-account player).
// Each embed component calls this from useEffect; the first call appends the
// <script> to <body>, subsequent calls find it and skip-or-attach. The onload
// callback fires exactly once when the script has actually loaded — even when
// a sibling component started the load. The trick is a `data-loaded="true"`
// flag set in our own load handler; without it, attaching `load` to a script
// that already loaded never fires.
import { useEffect } from 'preact/hooks';

interface Options {
  onload?: () => void;
}

export function useEmbedScript(src: string, opts: Options = {}): void {
  const { onload } = opts;
  useEffect(() => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        onload?.();
      } else if (onload) {
        existing.addEventListener('load', onload, { once: true });
      }
      return;
    }
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
    });
    if (onload) script.addEventListener('load', onload, { once: true });
    document.body.appendChild(script);
  }, [src]);
}
