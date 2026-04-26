import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { MostPopular } from './MostPopular';
import { getByHeading } from '../test-utils/dom';
import type { HomepagePost } from '@aje-poc/shared-types';

const items: HomepagePost[] = Array.from({ length: 10 }).map((_, i) => ({
  id: String(1000 + i),
  title: `Most popular item ${i + 1}`,
  link: `/item/${i + 1}`,
  postType: 'post',
}));

describe('MostPopular', () => {
  it('renders 10 items in fixture order as an ordered list', async () => {
    const { screen, render } = await createDOM();
    await render(<MostPopular items={items} />);
    const links = screen.querySelectorAll('ol li a');
    expect(links.length).toBe(10);
    items.forEach((item, i) => {
      expect(links[i].getAttribute('href')).toBe(item.link);
      expect(links[i].textContent).toContain(item.title);
    });
  });

  it('uses replacementHeadline when present instead of title', async () => {
    const overridden: HomepagePost = { ...items[0], replacementHeadline: 'Editor override' };
    const { screen, render } = await createDOM();
    await render(<MostPopular items={[overridden]} />);
    const link = screen.querySelector('ol li a')!;
    expect(link.textContent).toContain('Editor override');
    expect(link.textContent).not.toContain(items[0].title);
  });

  it('renders an h3 section heading (subordinate to HeroCard h2)', async () => {
    const { screen, render } = await createDOM();
    await render(<MostPopular items={items} />);
    expect(getByHeading(screen, 3, /Most Popular/i)).toBeTruthy();
  });

  it('renders nothing when items array is empty', async () => {
    const { screen, render } = await createDOM();
    await render(<MostPopular items={[]} />);
    expect(screen.querySelector('section')).toBeFalsy();
    expect(screen.querySelector('ol')).toBeFalsy();
  });
});
