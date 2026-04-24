import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { SectionHeading } from './SectionHeading';

describe('SectionHeading', () => {
  it('renders children inside an h3', async () => {
    const { screen, render } = await createDOM();
    await render(<SectionHeading>Most Popular</SectionHeading>);
    const h3 = screen.querySelector('h3')!;
    expect(h3.textContent).toBe('Most Popular');
  });

  it('passes children through (supports nested elements like a link wrapper)', async () => {
    const { screen, render } = await createDOM();
    await render(
      <SectionHeading>
        <a href="/features">Featured</a>
      </SectionHeading>,
    );
    const h3 = screen.querySelector('h3')!;
    expect(h3.querySelector('a')?.getAttribute('href')).toBe('/features');
    expect(h3.textContent).toContain('Featured');
  });

  it('uses the canonical Tailwind class string for section headings', async () => {
    const { screen, render } = await createDOM();
    await render(<SectionHeading>Topic</SectionHeading>);
    const h3 = screen.querySelector('h3')!;
    expect(h3.className).toContain('text-aj-orange');
    expect(h3.className).toContain('uppercase');
    expect(h3.className).toContain('tracking-wider');
  });

  it('renders as h2 when as="h2" (Footer landmark headings)', async () => {
    const { screen, render } = await createDOM();
    await render(<SectionHeading as="h2">Section</SectionHeading>);
    const h2 = screen.querySelector('h2')!;
    expect(h2).toBeTruthy();
    expect(h2.textContent).toBe('Section');
    expect(screen.querySelector('h3')).toBeFalsy();
    expect(h2.className).toContain('text-aj-orange');
  });
});
