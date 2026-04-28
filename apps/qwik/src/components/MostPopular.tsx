import { component$ } from '@qwik.dev/core';
import type { StoryCardData } from '@aje-poc/shared-types';
import { getDisplayHeadline } from '../lib/headline';
import { SectionHeading } from './SectionHeading';

interface Props {
  items: StoryCardData[];
}

export const MostPopular = component$<Props>(({ items }) => {
  if (items.length === 0) return null;
  return (
    <section class="most-popular">
      <SectionHeading>Most Popular</SectionHeading>
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
