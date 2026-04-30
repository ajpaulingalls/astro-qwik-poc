import { useEffect, useRef, useState } from 'preact/hooks';
import {
  createPollLoop,
  MAX_CONSECUTIVE_EMPTY_POLLS,
  TICKER_POLL_INTERVAL_MS,
  type BreakingTicker as BreakingTickerData,
  isBreakingTickerActive,
  resolvePollIntervalMs,
} from '@aje-poc/shared-types';
import { fetchBreakingTicker } from '../lib/ticker-api';

const POLL_INTERVAL_MS = resolvePollIntervalMs(
  import.meta.env.PUBLIC_LIVEBLOG_POLL_INTERVAL_MS,
  TICKER_POLL_INTERVAL_MS,
);

export function BreakingTicker() {
  const [ticker, setTicker] = useState<BreakingTickerData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    sectionRef.current?.setAttribute('data-hydrated', 'true');
    const { stop } = createPollLoop<BreakingTickerData>({
      tick: () => fetchBreakingTicker(),
      onResult: (fresh) => {
        if (!cancelled) setTicker(fresh);
      },
      // active→null transition: clear the displayed banner. Without this
      // the helper short-circuits null and the previously-set active banner
      // would stay on screen forever.
      onEmpty: () => {
        if (!cancelled) setTicker(null);
      },
      onError: (err) => console.error('breaking-ticker: poll tick failed:', err),
      shouldSkip: () => document.hidden,
      intervalMs: POLL_INTERVAL_MS,
      maxConsecutiveEmpty: MAX_CONSECUTIVE_EMPTY_POLLS,
      label: 'breaking-ticker',
      immediate: true,
    });
    return () => {
      cancelled = true;
      stop();
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
