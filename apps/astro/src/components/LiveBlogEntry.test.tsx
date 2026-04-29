// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/preact';
import { LiveBlogEntry } from './LiveBlogEntry';
import type { LiveBlogUpdate } from '../lib/load-liveblog';

const baseEntry: LiveBlogUpdate = {
  id: '4514943',
  title: 'Update title',
  shouldDisplayTitle: true,
  date: '2026-04-22T23:45:00',
  content: '<p>Update body HTML</p>',
};

describe('LiveBlogEntry', () => {
  afterEach(() => cleanup());

  it('renders the entry id as data-entry-id on a <section> wrapper (Updater diffs by id)', () => {
    const { container } = render(<LiveBlogEntry entry={baseEntry} />);
    const wrapper = container.querySelector('section[data-entry-id]');
    expect(wrapper).not.toBeNull();
    expect(wrapper!.getAttribute('data-entry-id')).toBe('4514943');
  });

  it('renders the title in an <h2> when shouldDisplayTitle is true', () => {
    const { getByRole } = render(<LiveBlogEntry entry={baseEntry} />);
    const h2 = getByRole('heading', { level: 2 });
    expect(h2.textContent).toBe('Update title');
  });

  it('omits the <h2> when shouldDisplayTitle is false', () => {
    const { queryByRole } = render(
      <LiveBlogEntry entry={{ ...baseEntry, shouldDisplayTitle: false }} />,
    );
    expect(queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('renders the content HTML body via dangerouslySetInnerHTML (parseEmbeds dispatch)', () => {
    const { container } = render(<LiveBlogEntry entry={baseEntry} />);
    expect(container.innerHTML).toContain('<p>Update body HTML</p>');
  });

  it('renders a <time> element with the ISO date in dateTime attribute', () => {
    const { container } = render(<LiveBlogEntry entry={baseEntry} />);
    const time = container.querySelector('time');
    expect(time!.getAttribute('datetime')).toBe('2026-04-22T23:45:00');
  });
});
