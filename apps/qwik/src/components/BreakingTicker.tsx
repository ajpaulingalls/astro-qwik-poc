import { component$, useSignal, useVisibleTask$ } from '@qwik.dev/core';
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

export const BreakingTicker = component$(() => {
  const ticker = useSignal<BreakingTickerData | null>(null);
  const dismissed = useSignal(false);
  const hydrated = useSignal(false);

  // useVisibleTask$ document-ready strategy + shared createPollLoop helper.
  // cleanup MUST register stop() via the callback so QRL teardown invokes
  // it. Diverges from LiveBlogUpdater via immediate:true so the banner can
  // populate on first paint instead of waiting one full cadence — the ticker
  // is not SSR-seeded, unlike the live-blog Updater.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    ({ cleanup }) => {
      hydrated.value = true;
      const { stop } = createPollLoop<BreakingTickerData>({
        tick: () => fetchBreakingTicker(),
        onResult: (fresh) => {
          ticker.value = fresh;
        },
        // active→null transition: clear the displayed banner. Without this
        // the helper short-circuits null and the previously-set active
        // banner would stay on screen forever.
        onEmpty: () => {
          ticker.value = null;
        },
        onError: (err) => console.error('breaking-ticker: poll tick failed:', err),
        shouldSkip: () => document.hidden,
        intervalMs: POLL_INTERVAL_MS,
        maxConsecutiveEmpty: MAX_CONSECUTIVE_EMPTY_POLLS,
        label: 'breaking-ticker',
        immediate: true,
      });
      cleanup(stop);
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
