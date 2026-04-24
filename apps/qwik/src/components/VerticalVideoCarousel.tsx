import { component$, $ } from '@qwik.dev/core';
import type { VerticalVideo } from '@aje-poc/shared-types';
import { SectionHeading } from './SectionHeading';

interface Props {
  videos: VerticalVideo[];
}

export const VerticalVideoCarousel = component$<Props>(({ videos }) => {
  if (videos.length === 0) return null;
  return (
    <section class="vertical-video-carousel">
      <SectionHeading>Videos</SectionHeading>
      <div data-carousel class="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2">
        {videos.map((v) => (
          <button
            key={v.id}
            type="button"
            data-tile
            data-video-id={v.id}
            onClick$={$(() => {
              document.dispatchEvent(
                new CustomEvent('vertical-video:open', { detail: { id: v.id } }),
              );
            })}
            class="snap-start shrink-0 w-32 text-left"
          >
            <div class="relative">
              <img
                src={v.thumbnail}
                alt={v.name}
                width={426}
                height={240}
                loading="lazy"
                class="w-full aspect-[9/16] object-cover rounded"
              />
              {v.duration && (
                <span class="absolute bottom-1 right-1 bg-neutral-900 text-white text-xs px-1 rounded">
                  {v.duration}
                </span>
              )}
            </div>
            <p class="text-xs mt-1 line-clamp-2">{v.name}</p>
          </button>
        ))}
      </div>
    </section>
  );
});
