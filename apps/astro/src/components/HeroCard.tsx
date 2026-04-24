import type { HomepagePost } from '@aje-poc/shared-types';
import { getDisplayHeadline } from '../lib/headline';
import { LiveBadge } from './LiveBadge';

interface Props {
  post: HomepagePost;
}

export function HeroCard({ post }: Props) {
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
            fetchpriority="high"
            class="w-full h-auto rounded aspect-[3/2] object-cover"
          />
        )}
        <div class="px-4 py-3">
          <LiveBadge isLive={post.isLive} />
          <h2 class="text-2xl font-bold mt-1">{getDisplayHeadline(post)}</h2>
          {post.excerpt && <p class="excerpt mt-2 text-neutral-700">{post.excerpt}</p>}
        </div>
      </a>
    </article>
  );
}
