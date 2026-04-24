// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
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
  it('renders the title and poster placeholder before play is clicked', async () => {
    const { screen, render } = await createDOM();
    await render(<LivestreamPlayer livestream={livestream} />);
    const h3 = screen.querySelector('h3')!;
    expect(h3.textContent).toContain('Al Jazeera Live');
    const img = screen.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://cdn.example/aje-live-poster.jpg');
    expect(screen.querySelector('iframe')).toBeFalsy();
  });

  it('clicking play swaps the placeholder for a Brightcove iframe', async () => {
    const { screen, render, userEvent } = await createDOM();
    await render(<LivestreamPlayer livestream={livestream} />);
    await userEvent('button[aria-label="Play livestream"]', 'click');
    const iframe = screen.querySelector('iframe')!;
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute('src')).toBe(
      'https://players.brightcove.net/665003303001/UbqgmlUbk_default/index.html?videoId=6368602483112',
    );
    expect(iframe.getAttribute('allow')).toContain('fullscreen');
  });

  it('placeholder image uses lazy loading + explicit dimensions for CLS', async () => {
    const { screen, render } = await createDOM();
    await render(<LivestreamPlayer livestream={livestream} />);
    const img = screen.querySelector('img')!;
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('width')).toBe('1280');
    expect(img.getAttribute('height')).toBe('720');
  });

  it('renders without poster when featuredImage is missing', async () => {
    const { screen, render } = await createDOM();
    await render(<LivestreamPlayer livestream={{ ...livestream, featuredImage: null }} />);
    expect(screen.querySelector('img')).toBeFalsy();
  });
});
