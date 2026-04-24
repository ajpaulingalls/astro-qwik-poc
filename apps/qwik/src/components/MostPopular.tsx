import { component$ } from '@qwik.dev/core';
import type { HomepagePost } from '../lib/homepage-types';
import { getDisplayHeadline } from '../lib/headline';

interface Props {
  items: HomepagePost[];
}

export const MostPopular = component$<Props>(({ items }) => {
  if (items.length === 0) return null;
  return (
    <section class="most-popular">
      <h3 class="text-aj-orange mb-3 text-sm font-bold tracking-wider uppercase">Most Popular</h3>
      <ol class="space-y-3 list-decimal list-inside">
        {items.map((item) => (
          <li key={item.id}>
            <a href={item.link} class="hover:text-aj-orange text-neutral-700">
              {getDisplayHeadline(item)}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
});
