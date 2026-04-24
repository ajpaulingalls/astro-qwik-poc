import type { HomepagePost } from '../lib/homepage-types';
import { getDisplayHeadline } from '../lib/headline';

interface Props {
  post: HomepagePost;
}

export function StoryCard({ post }: Props) {
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
            loading="lazy"
            class="w-full h-auto rounded aspect-[3/2] object-cover"
          />
        )}
        <div class="px-3 py-2">
          {post.isLive && (
            <span class="live-badge text-aj-orange text-xs font-bold tracking-wider uppercase">
              LIVE
            </span>
          )}
          <h3 class="text-base font-bold mt-1">{getDisplayHeadline(post)}</h3>
          {post.excerpt && <p class="excerpt mt-1 text-sm text-neutral-700">{post.excerpt}</p>}
        </div>
      </a>
    </article>
  );
}
