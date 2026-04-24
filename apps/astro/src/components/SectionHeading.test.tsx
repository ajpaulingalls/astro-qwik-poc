// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { SectionHeading } from './SectionHeading';

describe('SectionHeading', () => {
  afterEach(cleanup);

  it('renders children inside an h3', () => {
    const { getByRole } = render(<SectionHeading>Most Popular</SectionHeading>);
    expect(getByRole('heading', { level: 3, name: 'Most Popular' })).toBeTruthy();
  });

  it('passes children through (supports nested elements like a link wrapper)', () => {
    const { getByRole } = render(
      <SectionHeading>
        <a href="/features">Featured</a>
      </SectionHeading>,
    );
    const heading = getByRole('heading', { level: 3 });
    expect(heading.querySelector('a')?.getAttribute('href')).toBe('/features');
    expect(heading.textContent).toContain('Featured');
  });

  it('uses the canonical Tailwind class string for section headings', () => {
    const { container } = render(<SectionHeading>Topic</SectionHeading>);
    const h3 = container.querySelector('h3')!;
    expect(h3.className).toContain('text-aj-orange');
    expect(h3.className).toContain('uppercase');
    expect(h3.className).toContain('tracking-wider');
  });

  it('renders as h2 when as="h2" (Footer landmark headings)', () => {
    const { getByRole, container } = render(<SectionHeading as="h2">Section</SectionHeading>);
    expect(getByRole('heading', { level: 2, name: 'Section' })).toBeTruthy();
    expect(container.querySelector('h3')).toBeFalsy();
    expect(container.querySelector('h2')!.className).toContain('text-aj-orange');
  });
});
