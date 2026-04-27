import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LCP_PRELOAD_WIDTH,
  proportionalHeight,
  resizedImageUrl,
  resolveImageUrl,
} from './image-url';

describe('resolveImageUrl', () => {
  beforeEach(() => {
    vi.stubEnv('PUBLIC_API_BASE', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns "" for null, undefined, or empty input', () => {
    expect(resolveImageUrl(null)).toBe('');
    expect(resolveImageUrl(undefined)).toBe('');
    expect(resolveImageUrl('')).toBe('');
  });

  it('passes absolute http URLs through unchanged', () => {
    expect(resolveImageUrl('http://cdn.example.com/foo.jpg')).toBe(
      'http://cdn.example.com/foo.jpg',
    );
  });

  it('passes absolute https URLs through unchanged', () => {
    expect(resolveImageUrl('https://www.aljazeera.com/wp-content/uploads/foo.jpg')).toBe(
      'https://www.aljazeera.com/wp-content/uploads/foo.jpg',
    );
  });

  it('prefixes relative /wp-content/uploads/* URLs with default API base', () => {
    expect(resolveImageUrl('/wp-content/uploads/2026/04/foo.jpg')).toBe(
      'http://localhost:4455/wp-content/uploads/2026/04/foo.jpg',
    );
  });

  it('prefixes relative URLs with PUBLIC_API_BASE when set (M11 demo path)', () => {
    vi.stubEnv('PUBLIC_API_BASE', 'https://www.aljazeera.com');
    expect(resolveImageUrl('/wp-content/uploads/2026/04/foo.jpg')).toBe(
      'https://www.aljazeera.com/wp-content/uploads/2026/04/foo.jpg',
    );
  });
});

describe('resizedImageUrl', () => {
  it('returns "" for null, undefined, or empty input', () => {
    expect(resizedImageUrl(null, { width: 400 })).toBe('');
    expect(resizedImageUrl(undefined, { width: 400 })).toBe('');
    expect(resizedImageUrl('', { width: 400 })).toBe('');
  });

  it('emits a relative ?w=W&resize=W,H URL for relative input (preserves same-origin proxy)', () => {
    expect(resizedImageUrl('/wp-content/uploads/foo.jpg', { width: 400, height: 267 })).toBe(
      '/wp-content/uploads/foo.jpg?w=400&resize=400%2C267',
    );
  });

  it('defaults height to width when only width is supplied (square)', () => {
    expect(resizedImageUrl('/wp-content/uploads/foo.jpg', { width: 300 })).toBe(
      '/wp-content/uploads/foo.jpg?w=300&resize=300%2C300',
    );
  });

  it('passes absolute URLs through unchanged (avoid double-stamp on M11 production URLs)', () => {
    expect(
      resizedImageUrl('https://www.aljazeera.com/wp-content/uploads/foo.jpg', { width: 400 }),
    ).toBe('https://www.aljazeera.com/wp-content/uploads/foo.jpg');
  });

  it('passes absolute URLs through even when they already carry ?w= params', () => {
    // Production GraphQL responses already include resize hints in srcset URLs;
    // helper must not re-stamp or it would clobber the existing query string.
    expect(
      resizedImageUrl(
        'https://www.aljazeera.com/wp-content/uploads/foo.jpg?w=770&resize=770%2C770',
        {
          width: 400,
        },
      ),
    ).toBe('https://www.aljazeera.com/wp-content/uploads/foo.jpg?w=770&resize=770%2C770');
  });
});

describe('proportionalHeight', () => {
  it('returns null when image.width is missing (preload caller must skip the resize hint)', () => {
    expect(proportionalHeight(800, { height: 600 })).toBeNull();
  });

  it('returns null when image.height is missing', () => {
    expect(proportionalHeight(800, { width: 1200 })).toBeNull();
  });

  it('returns null when both natural dims are missing', () => {
    expect(proportionalHeight(800, {})).toBeNull();
  });

  it('returns width when image is square (1:1 aspect)', () => {
    expect(proportionalHeight(400, { width: 1000, height: 1000 })).toBe(400);
  });

  it('rounds the typical 3:2 article ratio (1200x800) at LCP_PRELOAD_WIDTH → 533', () => {
    // Anchored to LCP_PRELOAD_WIDTH (800) so a future preload-width change
    // surfaces the test name as well as the asserted value.
    expect(proportionalHeight(LCP_PRELOAD_WIDTH, { width: 1200, height: 800 })).toBe(533);
  });

  it('rounds 16:9 (1920x1080) at 800w → 450', () => {
    expect(proportionalHeight(800, { width: 1920, height: 1080 })).toBe(450);
  });
});
