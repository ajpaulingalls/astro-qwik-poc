// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { LiveBlogEntry } from './LiveBlogEntry';
import { getByHeading, queryByHeading } from '../test-utils/dom';

describe('LiveBlogEntry', () => {
  it('renders title as h2 when shouldDisplayTitle=true and injects content HTML', async () => {
    const { screen, render } = await createDOM();
    await render(
      <LiveBlogEntry
        entry={{
          id: '4514963',
          title: 'Newest update',
          shouldDisplayTitle: true,
          date: '2026-04-22T12:00:00',
          content: '<p>Body <strong>HTML</strong></p>',
        }}
      />,
    );
    expect(getByHeading(screen, 2, /Newest update/)).toBeTruthy();
    expect(screen.querySelector('strong')?.textContent).toBe('HTML');
  });

  it('omits the title heading when shouldDisplayTitle=false', async () => {
    const { screen, render } = await createDOM();
    await render(
      <LiveBlogEntry
        entry={{
          id: '4514963',
          title: 'Hidden title',
          shouldDisplayTitle: false,
          date: '2026-04-22T12:00:00',
          content: '<p>Just body</p>',
        }}
      />,
    );
    expect(queryByHeading(screen, 2, /Hidden title/)).toBeNull();
    expect(screen.textContent ?? '').toContain('Just body');
  });

  it('emits a stable per-entry data-entry-id for polling diffs and uses an <article> wrapper', async () => {
    const { screen, render } = await createDOM();
    await render(
      <LiveBlogEntry
        entry={{
          id: '4514963',
          title: 't',
          shouldDisplayTitle: true,
          date: '2026-04-22T12:00:00',
          content: '<p>x</p>',
        }}
      />,
    );
    const article = screen.querySelector('article[data-entry-id="4514963"]');
    expect(article).not.toBeNull();
  });
});
