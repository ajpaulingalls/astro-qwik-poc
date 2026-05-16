import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { SectionHeading } from './SectionHeading';
import { getByHeading, queryByHeading } from '../test-utils/dom';

describe('SectionHeading', () => {
  it('renders children inside an h3', async () => {
    const { screen, render } = await createDOM();
    await render(<SectionHeading>Most Popular</SectionHeading>);
    expect(getByHeading(screen, 3, /Most Popular/i)).toBeTruthy();
  });

  it('passes children through (supports nested elements like a link wrapper)', async () => {
    const { screen, render } = await createDOM();
    await render(
      <SectionHeading>
        <a href="/features">Featured</a>
      </SectionHeading>,
    );
    const h3 = getByHeading(screen, 3, /Featured/i);
    expect(h3.querySelector('a')?.getAttribute('href')).toBe('/features');
  });

  it('uses the canonical Tailwind class string for section headings', async () => {
    const { screen, render } = await createDOM();
    await render(<SectionHeading>Topic</SectionHeading>);
    const h3 = getByHeading(screen, 3, /Topic/i);
    expect(h3.className).toContain('text-aj-orange');
    expect(h3.className).toContain('uppercase');
    expect(h3.className).toContain('tracking-wider');
  });

  it('renders a left orange accent bar (editorial section marker)', async () => {
    const { screen, render } = await createDOM();
    await render(<SectionHeading>Topic</SectionHeading>);
    const h3 = getByHeading(screen, 3, /Topic/i);
    expect(h3.className).toContain('border-l-4');
    expect(h3.className).toContain('border-aj-orange');
    expect(h3.className).toContain('pl-2');
  });

  it('renders as h2 when as="h2" (Footer landmark headings)', async () => {
    const { screen, render } = await createDOM();
    await render(<SectionHeading as="h2">Section</SectionHeading>);
    const h2 = getByHeading(screen, 2, /Section/i);
    expect(queryByHeading(screen, 3, /Section/i)).toBeNull();
    expect(h2.className).toContain('text-aj-orange');
  });
});
