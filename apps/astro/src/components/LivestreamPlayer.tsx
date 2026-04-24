import { useEffect, useRef, useState } from 'preact/hooks';
import type { Livestream } from '../lib/homepage-types';
import { SectionHeading } from './SectionHeading';

interface Props {
  livestream: Livestream;
}

function brightcoveSrc(accountId: string, playerID: string, videoId: string): string {
  return `https://players.brightcove.net/${accountId}/${playerID}_default/index.html?videoId=${videoId}`;
}

export function LivestreamPlayer({ livestream }: Props) {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    function onOpen(e: Event) {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (id) setActiveVideoId(id);
    }
    document.addEventListener('vertical-video:open', onOpen);
    return () => document.removeEventListener('vertical-video:open', onOpen);
  }, []);

  // When the placeholder is replaced by the iframe the play button is
  // unmounted; without this, focus falls back to <body> for keyboard users.
  useEffect(() => {
    if (activeVideoId !== null) iframeRef.current?.focus();
  }, [activeVideoId]);

  const playing = activeVideoId !== null;
  const videoId = activeVideoId ?? livestream.videoID;

  return (
    <section class="livestream-player">
      <SectionHeading>{livestream.title}</SectionHeading>
      <div class="relative aspect-video bg-neutral-900 rounded overflow-hidden">
        {playing ? (
          <iframe
            ref={iframeRef}
            src={brightcoveSrc(livestream.accountId, livestream.playerID, videoId)}
            allow="autoplay; fullscreen; encrypted-media"
            allowFullScreen
            // Skip iframe element itself in sequential tab order; programmatic
            // focus() (above) still works, and keys then move into player UI.
            tabIndex={-1}
            title={livestream.title}
            class="w-full h-full"
          />
        ) : (
          <>
            {livestream.featuredImage && (
              <img
                src={livestream.featuredImage.sourceUrl}
                alt={livestream.featuredImage.alt ?? livestream.title}
                width={livestream.featuredImage.width}
                height={livestream.featuredImage.height}
                loading="lazy"
                class="w-full h-full object-cover"
              />
            )}
            <button
              type="button"
              onClick={() => setActiveVideoId(livestream.videoID)}
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
}
