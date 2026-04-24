// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/preact';
import { LivestreamPlayer } from './LivestreamPlayer';
import type { Livestream } from '../lib/homepage-types';

const livestream: Livestream = {
  accountId: '665003303001',
  playerID: 'UbqgmlUbk',
  videoID: '6368602483112',
  title: 'Al Jazeera Live',
  source: 'brightcove',
  featuredImage: {
    sourceUrl: 'https://cdn.example/aje-live-poster.jpg',
    alt: 'Al Jazeera Live stream',
    width: 1280,
    height: 720,
  },
};

describe('LivestreamPlayer', () => {
  afterEach(cleanup);

  it('renders the title and poster placeholder before play is clicked', () => {
    const { getByRole, container } = render(<LivestreamPlayer livestream={livestream} />);
    expect(getByRole('heading', { level: 3, name: /Al Jazeera Live/i })).toBeTruthy();
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://cdn.example/aje-live-poster.jpg');
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('clicking play swaps the placeholder for a Brightcove iframe with correct src', () => {
    const { getByRole, container } = render(<LivestreamPlayer livestream={livestream} />);
    fireEvent.click(getByRole('button', { name: /play/i }));
    const iframe = container.querySelector('iframe')!;
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute('src')).toBe(
      'https://players.brightcove.net/665003303001/UbqgmlUbk_default/index.html?videoId=6368602483112',
    );
    expect(iframe.getAttribute('allow')).toContain('fullscreen');
  });

  it('placeholder image uses lazy loading + explicit dimensions for CLS', () => {
    const { container } = render(<LivestreamPlayer livestream={livestream} />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('width')).toBe('1280');
    expect(img.getAttribute('height')).toBe('720');
  });

  it('renders without poster when featuredImage is missing', () => {
    const { container } = render(
      <LivestreamPlayer livestream={{ ...livestream, featuredImage: null }} />,
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('listens for vertical-video:open events and starts playing the requested video', () => {
    const { container } = render(<LivestreamPlayer livestream={livestream} />);
    expect(container.querySelector('iframe')).toBeNull();
    act(() => {
      document.dispatchEvent(
        new CustomEvent('vertical-video:open', { detail: { id: '9999999999999' } }),
      );
    });
    const iframe = container.querySelector('iframe')!;
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute('src')).toContain('videoId=9999999999999');
    expect(iframe.getAttribute('src')).toContain('665003303001');
  });

  it('moves focus to the iframe when the placeholder is replaced (keyboard a11y)', () => {
    const { getByRole, container } = render(<LivestreamPlayer livestream={livestream} />);
    fireEvent.click(getByRole('button', { name: /play/i }));
    const iframe = container.querySelector('iframe')!;
    expect(document.activeElement).toBe(iframe);
  });
});
