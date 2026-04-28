import { component$, useSignal, useOnDocument, useTask$, $ } from '@qwik.dev/core';
import type { Livestream } from '@aje-poc/shared-types';
import { resolveImageUrl } from '../lib/image-url';
import { SectionHeading } from './SectionHeading';

interface Props {
  livestream: Livestream;
}

function brightcoveSrc(accountId: string, playerID: string, videoId: string): string {
  return `https://players.brightcove.net/${accountId}/${playerID}_default/index.html?videoId=${videoId}`;
}

export const LivestreamPlayer = component$<Props>(({ livestream }) => {
  const activeVideoId = useSignal<string | null>(null);
  const iframeRef = useSignal<HTMLIFrameElement>();

  // Cross-island event from VerticalVideoCarousel: switch to the requested
  // vertical video. useOnDocument lazy-loads the listener via $() — handler
  // chunk only ships when qwikLoader bootstraps the component.
  useOnDocument(
    'vertical-video:open',
    $((e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (id) activeVideoId.value = id;
    }),
  );

  // When the placeholder is replaced by the iframe the play button is
  // unmounted; without this, focus falls back to <body> for keyboard users.
  useTask$(({ track }) => {
    track(() => activeVideoId.value);
    if (activeVideoId.value !== null) iframeRef.value?.focus();
  });

  const playing = activeVideoId.value !== null;
  const videoId = activeVideoId.value ?? livestream.videoID;

  return (
    <section class="livestream-player">
      <SectionHeading>{livestream.title}</SectionHeading>
      <div class="relative aspect-video bg-neutral-900 rounded overflow-hidden">
        {playing ? (
          <iframe
            ref={iframeRef}
            src={brightcoveSrc(livestream.accountId, livestream.playerID, videoId)}
            allow="autoplay; fullscreen; encrypted-media"
            allowFullscreen
            // tabIndex=-1 keeps the iframe out of sequential tab order
            // (the player UI inside has its own tab stops); programmatic
            // focus() above still works.
            tabIndex={-1}
            title={livestream.title}
            class="w-full h-full"
          />
        ) : (
          <>
            {livestream.featuredImage && (
              <img
                src={resolveImageUrl(livestream.featuredImage.sourceUrl)}
                alt={livestream.featuredImage.alt ?? livestream.title}
                width={livestream.featuredImage.width}
                height={livestream.featuredImage.height}
                loading="lazy"
                class="w-full h-full object-cover"
              />
            )}
            <button
              type="button"
              onClick$={$(() => {
                activeVideoId.value = livestream.videoID;
              })}
              aria-label="Play livestream"
              class="absolute inset-0 flex items-center justify-center bg-neutral-900/40 hover:bg-neutral-900/60 text-white"
            >
              <span class="text-4xl">▶</span>
            </button>
          </>
        )}
      </div>
    </section>
  );
});
