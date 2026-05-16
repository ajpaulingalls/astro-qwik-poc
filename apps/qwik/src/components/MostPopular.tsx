import type { StoryCardData } from '@aje-poc/shared-types';
import { getDisplayHeadline } from '../lib/headline';
import { SectionHeading } from './SectionHeading';

interface Props {
  items: StoryCardData[];
}

export function MostPopular({ items }: Props) {
  if (items.length === 0) return null;
  return (
    <section class="most-popular">
      <SectionHeading>Most Popular</SectionHeading>
      <ol class="most-popular-list list-none divide-y divide-neutral-200">
        {items.map((item) => (
          <li key={item.id} class="py-2">
            <a href={item.link} class="hover:text-aj-orange text-neutral-800">
              {getDisplayHeadline(item)}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
