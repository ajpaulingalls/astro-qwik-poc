// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { VerticalVideoCarousel } from './VerticalVideoCarousel';
import type { VerticalVideo } from '@aje-poc/shared-types';

const video = (i: number): VerticalVideo => ({
  id: String(6393598694000 + i),
  name: `Video ${i + 1}`,
  thumbnail: `https://cdn.example/thumb-${i}.jpg`,
  poster: `https://cdn.example/poster-${i}.jpg`,
  duration: '00:43',
  accountId: '665003303001',
});

const videos = Array.from({ length: 10 }).map((_, i) => video(i));

describe('VerticalVideoCarousel', () => {
  it('renders all 10 video tiles in fixture order', async () => {
    const { screen, render } = await createDOM();
    await render(<VerticalVideoCarousel videos={videos} />);
    const tiles = screen.querySelectorAll('button[data-video-id]');
    expect(tiles.length).toBe(10);
    videos.forEach((v, i) => {
      expect(tiles[i].textContent).toContain(v.name);
    });
  });

  it('tile thumbnail uses lazy loading and alt text', async () => {
    const { screen, render } = await createDOM();
    await render(<VerticalVideoCarousel videos={videos} />);
    const img = screen.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(videos[0].thumbnail);
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('alt')).toBe(videos[0].name);
  });

  it('renders the duration badge for each tile', async () => {
    const { screen, render } = await createDOM();
    await render(<VerticalVideoCarousel videos={[video(0)]} />);
    expect(screen.querySelector('section')?.textContent).toContain('00:43');
  });

  it('strip has horizontal-scroll class enabling native swipe/touch', async () => {
    const { screen, render } = await createDOM();
    await render(<VerticalVideoCarousel videos={videos} />);
    const strip = screen.querySelector('section > div')!;
    expect(strip.className).toContain('overflow-x-auto');
    expect(strip.className).toContain('flex');
  });

  it('clicking a tile dispatches a vertical-video:open CustomEvent with the video id', async () => {
    // Relies on happy-dom's shared global `document`: this listener and
    // userEvent's click dispatch must hit the same Document instance.
    const { screen, render, userEvent } = await createDOM();
    await render(<VerticalVideoCarousel videos={videos} />);
    let captured: string | null = null;
    const listener = (e: Event) => {
      captured = (e as CustomEvent<{ id: string }>).detail.id;
    };
    document.addEventListener('vertical-video:open', listener);
    try {
      await userEvent('button[data-video-id]:nth-of-type(3)', 'click');
      expect(captured).toBe(videos[2].id);
    } finally {
      document.removeEventListener('vertical-video:open', listener);
    }
    // sanity: querySelector found 10 tiles
    expect(screen.querySelectorAll('button[data-video-id]').length).toBe(10);
  });

  it('returns null when videos array is empty', async () => {
    const { screen, render } = await createDOM();
    await render(<VerticalVideoCarousel videos={[]} />);
    expect(screen.querySelector('section')).toBeFalsy();
  });
});
