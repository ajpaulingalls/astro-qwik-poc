// Unit-tests for the pure parsing helper inside live-endpoint-tests.ts.
// Browser interaction (`page.$$eval`) is mocked at the integration layer;
// the parsing logic itself is testable in isolation against a synthetic
// list of homepage href strings.

import { describe, it, expect } from 'vitest';
import { parseFirstLivePaths } from '../acceptance/live-endpoint-tests.ts';

describe('parseFirstLivePaths', () => {
  it('returns the first /news/<date>/<slug> and first /news/liveblog/<date>/<slug>', () => {
    const hrefs = [
      '/about',
      '/news/2026/4/30/regular-article-one',
      '/news/2026/4/30/regular-article-two',
      '/news/liveblog/2026/4/30/iran-war-live-update',
      '/news/liveblog/2026/4/30/another-liveblog',
      '/middle-east',
    ];
    expect(parseFirstLivePaths(hrefs)).toEqual({
      article: '/news/2026/4/30/regular-article-one',
      liveblog: '/news/liveblog/2026/4/30/iran-war-live-update',
    });
  });

  it('does not confuse /news/liveblog/... for an /news/<slug> article', () => {
    const hrefs = ['/news/liveblog/2026/4/30/iran-war-live', '/news/2026/4/30/real-article'];
    expect(parseFirstLivePaths(hrefs)).toEqual({
      article: '/news/2026/4/30/real-article',
      liveblog: '/news/liveblog/2026/4/30/iran-war-live',
    });
  });

  it('throws a diagnostic naming the first 5 article links when no liveblog is found', () => {
    const hrefs = [
      '/news/2026/4/30/article-one',
      '/news/2026/4/30/article-two',
      '/news/2026/4/30/article-three',
      '/news/2026/4/30/article-four',
      '/news/2026/4/30/article-five',
      '/news/2026/4/30/article-six',
      '/about',
    ];
    expect(() => parseFirstLivePaths(hrefs)).toThrow(/no.*liveblog.*link.*found/i);
    // Diagnostic should include the first article link to help an operator
    // see whether the homepage was actually parsed.
    expect(() => parseFirstLivePaths(hrefs)).toThrow(/article-one/);
  });

  it('throws when no /news/<date>/<slug> article link is found at all', () => {
    const hrefs = ['/about', '/middle-east', '/news/liveblog/2026/4/30/only-liveblog'];
    expect(() => parseFirstLivePaths(hrefs)).toThrow(/no.*article.*link.*found/i);
  });

  it('ignores anchor variants and absolute URLs from other origins', () => {
    const hrefs = [
      'https://twitter.com/news/2026/4/30/not-our-link',
      '/news/2026/4/30/our-article',
      '#top',
      '/news/liveblog/2026/4/30/our-liveblog',
    ];
    expect(parseFirstLivePaths(hrefs)).toEqual({
      article: '/news/2026/4/30/our-article',
      liveblog: '/news/liveblog/2026/4/30/our-liveblog',
    });
  });
});
