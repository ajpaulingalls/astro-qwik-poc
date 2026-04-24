import type { CuratedCollectionItem } from '../lib/homepage-types';
import { getDisplayHeadline } from '../lib/headline';

interface Props {
  collection: CuratedCollectionItem;
}

export function CuratedCollection({ collection }: Props) {
  if (collection.posts.length === 0) return null;
  const heading = collection.overrideLink ? (
    <a href={collection.overrideLink} class="hover:text-aj-orange">
      {collection.title}
    </a>
  ) : (
    collection.title
  );
  return (
    <section class="curated-collection">
      <h3 class="text-aj-orange mb-3 text-sm font-bold tracking-wider uppercase">{heading}</h3>
      <ul class="space-y-3">
        {collection.posts.map((post) => (
          <li>
            <a href={post.link} class="hover:text-aj-orange text-neutral-700">
              {getDisplayHeadline(post)}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
