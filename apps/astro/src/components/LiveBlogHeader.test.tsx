// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { LiveBlogHeader, type LiveBlogHeaderData } from './LiveBlogHeader';

const baseHeader: LiveBlogHeaderData = {
  title: 'Iran war live',
  isLive: true,
  date: '2026-04-22T00:00:00',
};

describe('LiveBlogHeader', () => {
  afterEach(() => cleanup());

  it('renders the title in an <h1>', () => {
    const { getByRole } = render(<LiveBlogHeader header={baseHeader} />);
    const h1 = getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Iran war live');
  });

  it('renders the LIVE badge when isLive is true', () => {
    const { container } = render(<LiveBlogHeader header={baseHeader} />);
    expect(container.textContent).toContain('LIVE');
  });

  it('omits the LIVE badge when isLive is false', () => {
    const { container } = render(<LiveBlogHeader header={{ ...baseHeader, isLive: false }} />);
    expect(container.textContent).not.toContain('LIVE');
  });

  it('renders the subheading when present (preferred over excerpt)', () => {
    const { container } = render(
      <LiveBlogHeader
        header={{ ...baseHeader, subheading: 'Subhead text', excerpt: 'Excerpt text' }}
      />,
    );
    expect(container.textContent).toContain('Subhead text');
    expect(container.textContent).not.toContain('Excerpt text');
  });

  it('falls back to excerpt when subheading is absent', () => {
    const { container } = render(
      <LiveBlogHeader header={{ ...baseHeader, excerpt: 'Excerpt text' }} />,
    );
    expect(container.textContent).toContain('Excerpt text');
  });

  it('renders a <time> element with the ISO date in dateTime attribute', () => {
    const { container } = render(<LiveBlogHeader header={baseHeader} />);
    const time = container.querySelector('time');
    expect(time).not.toBeNull();
    expect(time!.getAttribute('datetime')).toBe('2026-04-22T00:00:00');
  });
});
