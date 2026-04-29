import { component$, useSignal, useVisibleTask$ } from '@qwik.dev/core';
import {
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

export const BreakingTicker = component$(() => {
  const ticker = useSignal<BreakingTickerData | null>(null);
  const dismissed = useSignal(false);
  const hydrated = useSignal(false);

  // useVisibleTask$ document-ready strategy + manual setInterval (allowStale
  // absent in beta.32). cleanup MUST register clearInterval via the callback
  // so QRL teardown invokes it. Diverges from LiveBlogUpdater: tick() fires
  // immediately so the banner can populate on first paint instead of waiting
  // 30s — LiveBlogUpdater is SSR-seeded and only polls.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    ({ cleanup }) => {
      hydrated.value = true;
      let polling = false;
      const tick = async () => {
        if (polling) return;
        if (document.hidden) return;
        polling = true;
        try {
          ticker.value = await fetchBreakingTicker();
        } catch (err) {
          console.error('breaking-ticker: poll tick failed:', err);
        } finally {
          polling = false;
        }
      };
      tick();
      const intervalId = setInterval(tick, POLL_INTERVAL_MS);
      cleanup(() => clearInterval(intervalId));
    },
    { strategy: 'document-ready' },
  );

  const visible = isBreakingTickerActive(ticker.value) && !dismissed.value;

  return (
    <section
      data-breaking-ticker
      data-hydrated={hydrated.value ? 'true' : 'false'}
      role="status"
      aria-live="polite"
      class="breaking-ticker"
    >
      {visible && ticker.value && (
        <div data-breaking-ticker-banner class="breaking-ticker-banner">
          {ticker.value.tickerTitle && (
            <strong class="breaking-ticker-title">{ticker.value.tickerTitle}: </strong>
          )}
          <span class="breaking-ticker-text">{ticker.value.tickerText}</span>
          {ticker.value.link && (
            <a class="breaking-ticker-link" href={ticker.value.link}>
              Read more
            </a>
          )}
          <button
            type="button"
            data-breaking-ticker-dismiss
            class="breaking-ticker-dismiss"
            aria-label="Dismiss breaking news"
            onClick$={() => {
              dismissed.value = true;
            }}
          >
            ×
          </button>
        </div>
      )}
    </section>
  );
});
