import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import type { LiveBlogShell, LiveBlogChildrenIds } from './index';

const LIVEBLOG_SLUG = 'iran-war-live-trump-says-ceasefire-extended-as-talks-with-tehran-in-limbo';
const FIXTURES_DIR = join(__dirname, '..', 'mock-api', 'fixtures');
// Live-blog fixtures are snapshot-rotated on disk; snapshot-0 is the recorded
// production baseline. Pinned here so type/shape conformance tests stay
// deterministic as new snapshots (1, 2, …) land.
const FIXTURE_PATH = join(
  FIXTURES_DIR,
  `ArchipelagoSingleLiveBlogQuery--${LIVEBLOG_SLUG}--snapshot-0.json`,
);
const CHILDREN_FIXTURE_PATH = join(
  FIXTURES_DIR,
  `SingleLiveBlogChildrensQuery--${LIVEBLOG_SLUG}--snapshot-0.json`,
);

interface ShellFixture {
  data: { article: LiveBlogShell };
}

interface ChildrenFixture {
  data: { article: { children: LiveBlogChildrenIds } };
}

describe('LiveBlogShell type vs ArchipelagoSingleLiveBlogQuery fixture', () => {
  it('every required LiveBlogShell field is present in the production-recorded shell', () => {
    const raw = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) satisfies ShellFixture;
    const shell = raw.data.article;
    expect(typeof shell.id).toBe('string');
    expect(typeof shell.title).toBe('string');
    expect(typeof shell.link).toBe('string');
    expect(typeof shell.slug).toBe('string');
    expect(typeof shell.date).toBe('string');
    expect(typeof shell.content).toBe('string');
    expect(Array.isArray(shell.author)).toBe(true);
    expect(Array.isArray(shell.categories)).toBe(true);
    expect(shell.postType).toBe('liveblog');
    expect(typeof shell.isLive).toBe('boolean');
    expect(Array.isArray(shell.children)).toBe(true);
  });

  it('childrenMeta entries (when present) match LiveBlogChildMeta shape', () => {
    const raw = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) satisfies ShellFixture;
    const meta = raw.data.article.childrenMeta;
    if (!meta) return;
    expect(meta.length).toBeGreaterThan(0);
    for (const entry of meta) {
      expect(typeof entry.id).toBe('string');
      expect(typeof entry.publishedTime).toBe('string');
    }
  });
});

describe('LiveBlogChildrenIds type vs SingleLiveBlogChildrensQuery fixture', () => {
  it('parses children fixture as number[]', () => {
    const raw = JSON.parse(readFileSync(CHILDREN_FIXTURE_PATH, 'utf8')) satisfies ChildrenFixture;
    const ids = raw.data.article.children;
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(typeof id).toBe('number');
    }
  });
});
