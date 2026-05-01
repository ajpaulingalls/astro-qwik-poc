// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { MostPopular } from './MostPopular';
import type { HomepagePost } from '@aje-poc/shared-types';

const items: HomepagePost[] = Array.from({ length: 10 }).map((_, i) => ({
  id: String(1000 + i),
  title: `Most popular item ${i + 1}`,
  link: `/item/${i + 1}`,
  postType: 'post',
}));

describe('MostPopular', () => {
  afterEach(cleanup);

  it('renders 10 items in fixture order as an ordered list', () => {
    const { container } = render(<MostPopular items={items} />);
    const links = container.querySelectorAll('ol li a');
    expect(links.length).toBe(10);
    items.forEach((item, i) => {
      expect(links[i].getAttribute('href')).toBe(item.link);
      expect(links[i].textContent).toContain(item.title);
    });
  });

  it('uses replacementHeadline when present instead of title', () => {
    const overridden: HomepagePost = { ...items[0], replacementHeadline: 'Editor override' };
    const { container } = render(<MostPopular items={[overridden]} />);
    const link = container.querySelector('ol li a')!;
    expect(link.textContent).toContain('Editor override');
    expect(link.textContent).not.toContain(items[0].title);
  });

  it('renders an h3 section heading (subordinate to HeroCard h2)', () => {
    const { getByRole } = render(<MostPopular items={items} />);
    expect(getByRole('heading', { level: 3, name: /most popular/i })).toBeTruthy();
  });

  it('renders nothing when items array is empty', () => {
    const { container } = render(<MostPopular items={[]} />);
    expect(container.querySelector('section')).toBeNull();
    expect(container.querySelector('ol')).toBeNull();
  });

  it('uses a custom counter (no native list-decimal markers, items separated)', () => {
    const { container } = render(<MostPopular items={items} />);
    const ol = container.querySelector('ol')!;
    expect(ol.className).toContain('list-none');
    expect(ol.className).toContain('divide-y');
  });
});
