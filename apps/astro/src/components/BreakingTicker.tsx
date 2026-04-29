import { useEffect, useRef, useState } from 'preact/hooks';
import {
  TICKER_POLL_INTERVAL_MS,
  type BreakingTicker as BreakingTickerData,
  isBreakingTickerActive,
} from '@aje-poc/shared-types';
import { fetchBreakingTicker } from '../lib/ticker-api';

export function BreakingTicker() {
  const [ticker, setTicker] = useState<BreakingTickerData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  // Mirrors the LiveBlogUpdater concurrency guard.
  const pollingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (pollingRef.current) return;
      if (document.hidden) return;
      pollingRef.current = true;
      try {
        const fresh = await fetchBreakingTicker();
        if (!cancelled) setTicker(fresh);
      } catch (err) {
        console.error('breaking-ticker: poll tick failed:', err);
      } finally {
        pollingRef.current = false;
      }
    };
    sectionRef.current?.setAttribute('data-hydrated', 'true');
    tick();
    const intervalId = setInterval(tick, TICKER_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  const visible = isBreakingTickerActive(ticker) && !dismissed;

  return (
    <section
      ref={sectionRef}
      data-breaking-ticker
      data-hydrated="false"
      role="status"
      aria-live="polite"
      class="breaking-ticker"
    >
      {visible && ticker && (
        <div data-breaking-ticker-banner class="breaking-ticker-banner">
          {ticker.tickerTitle && (
            <strong class="breaking-ticker-title">{ticker.tickerTitle}: </strong>
          )}
          <span class="breaking-ticker-text">{ticker.tickerText}</span>
          {ticker.link && (
            <a class="breaking-ticker-link" href={ticker.link}>
              Read more
            </a>
          )}
          <button
            type="button"
            data-breaking-ticker-dismiss
            class="breaking-ticker-dismiss"
            aria-label="Dismiss breaking news"
            onClick={() => setDismissed(true)}
          >
            ×
          </button>
        </div>
      )}
    </section>
  );
}
