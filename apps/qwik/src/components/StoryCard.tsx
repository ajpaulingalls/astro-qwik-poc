import { component$ } from '@qwik.dev/core';
import type { HomepagePost } from '@aje-poc/shared-types';
import { getDisplayHeadline } from '../lib/headline';
import { resolveImageUrl } from '../lib/image-url';
import { LiveBadge } from './LiveBadge';

interface Props {
  post: HomepagePost;
}

export const StoryCard = component$<Props>(({ post }) => {
  const img = post.featuredImage ?? null;
  return (
    <article>
      <a href={post.link} class="block">
        {img && (
          <img
            src={resolveImageUrl(img.sourceUrl)}
            alt={img.alt ?? ''}
            width={img.width}
            height={img.height}
            loading="lazy"
            class="w-full h-auto rounded aspect-[3/2] object-cover"
          />
        )}
        <div class="px-3 py-2">
          <LiveBadge isLive={post.isLive} />
          <h3 class="text-base font-bold mt-1">{getDisplayHeadline(post)}</h3>
          {post.excerpt && <p class="excerpt mt-1 text-sm text-neutral-700">{post.excerpt}</p>}
        </div>
      </a>
    </article>
  );
});
