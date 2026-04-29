// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { LiveBlogHeader } from './LiveBlogHeader';
import { getByHeading, queryByHeading } from '../test-utils/dom';

describe('LiveBlogHeader', () => {
  it('renders title as h1, the subheading, and the LIVE badge when isLive=true', async () => {
    const { screen, render } = await createDOM();
    await render(
      <LiveBlogHeader
        header={{
          title: 'Iran war live',
          subheading: 'Ceasefire extended',
          isLive: true,
          date: '2026-04-22T00:00:00',
        }}
      />,
    );
    expect(getByHeading(screen, 1, /Iran war live/)).toBeTruthy();
    const text = screen.textContent ?? '';
    expect(text).toContain('Ceasefire extended');
    expect(text).toContain('LIVE');
  });

  it('omits subheading paragraph when not provided and falls back to excerpt for description', async () => {
    const { screen, render } = await createDOM();
    await render(
      <LiveBlogHeader
        header={{
          title: 'Live',
          excerpt: 'Excerpt body',
          isLive: true,
          date: '2026-04-22T00:00:00',
        }}
      />,
    );
    expect(screen.textContent ?? '').toContain('Excerpt body');
  });

  it('hides LIVE badge when isLive=false', async () => {
    const { screen, render } = await createDOM();
    await render(
      <LiveBlogHeader header={{ title: 'Closed', isLive: false, date: '2026-04-22T00:00:00' }} />,
    );
    expect(screen.textContent ?? '').not.toContain('LIVE');
    expect(queryByHeading(screen, 1, /Closed/)).toBeTruthy();
  });
});
