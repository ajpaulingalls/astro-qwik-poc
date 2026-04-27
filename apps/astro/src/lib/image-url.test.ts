import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resizedImageUrl, resolveImageUrl } from './image-url';

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
