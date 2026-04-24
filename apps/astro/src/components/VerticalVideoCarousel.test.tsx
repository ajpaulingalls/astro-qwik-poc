// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/preact';
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
  afterEach(cleanup);

  it('renders all 10 video tiles in fixture order', () => {
    const { container } = render(<VerticalVideoCarousel videos={videos} />);
    const tiles = container.querySelectorAll('[data-tile]');
    expect(tiles.length).toBe(10);
    videos.forEach((v, i) => {
      expect(tiles[i].textContent).toContain(v.name);
    });
  });

  it('tile thumbnail uses lazy loading with explicit dimensions for CLS protection', () => {
    const { container } = render(<VerticalVideoCarousel videos={videos} />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(videos[0].thumbnail);
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('alt')).toBe(videos[0].name);
  });

  it('renders the duration badge for each tile', () => {
    const { container } = render(<VerticalVideoCarousel videos={[video(0)]} />);
    expect(container.textContent).toContain('00:43');
  });

  it('strip has horizontal-scroll class enabling native swipe/touch behavior', () => {
    const { container } = render(<VerticalVideoCarousel videos={videos} />);
    const strip = container.querySelector('[data-carousel]')!;
    expect(strip.className).toContain('overflow-x-auto');
    expect(strip.className).toContain('flex');
  });

  it('clicking a tile dispatches a custom event with the video id', () => {
    const { container } = render(<VerticalVideoCarousel videos={videos} />);
    const tile = container.querySelectorAll('[data-tile]')[2] as HTMLElement;
    let captured: string | null = null;
    document.addEventListener('vertical-video:open', (e) => {
      captured = (e as CustomEvent<{ id: string }>).detail.id;
    });
    fireEvent.click(tile);
    expect(captured).toBe(videos[2].id);
  });

  it('returns null when videos array is empty', () => {
    const { container } = render(<VerticalVideoCarousel videos={[]} />);
    expect(container.querySelector('[data-carousel]')).toBeNull();
  });
});
