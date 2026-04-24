import { component$ } from '@qwik.dev/core';
import type { HomepagePost } from '../lib/homepage-types';
import { getDisplayHeadline } from '../lib/headline';

interface Props {
  post: HomepagePost;
}

export const HeroCard = component$<Props>(({ post }) => {
  const img = post.featuredImage ?? null;
  return (
    <article>
      <a href={post.link} class="block">
        {img && (
          <img
            src={img.sourceUrl}
            alt={img.alt ?? ''}
            width={img.width}
            height={img.height}
            loading="eager"
            fetchPriority="high"
            class="w-full h-auto rounded aspect-[3/2] object-cover"
          />
        )}
        <div class="px-4 py-3">
          {post.isLive && (
            <span class="live-badge text-aj-orange text-xs font-bold tracking-wider uppercase">
              LIVE
            </span>
          )}
          <h2 class="text-2xl font-bold mt-1">{getDisplayHeadline(post)}</h2>
          {post.excerpt && <p class="excerpt mt-2 text-neutral-700">{post.excerpt}</p>}
        </div>
      </a>
    </article>
  );
});
