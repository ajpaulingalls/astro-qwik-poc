import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveImageUrl } from './image-url';

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
