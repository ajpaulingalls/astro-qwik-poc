// Splits CMS article HTML into renderable segments — text-html chunks separated
// by typed embed nodes. Each embed component (TwitterEmbed, InstagramEmbed,
// GalleryEmbed, BrightcoveEmbed) injects its provider script at mount time;
// the segmenter strips trailing provider scripts so they're not duplicated when
// the embed component re-emits the markup via dangerouslySetInnerHTML.
//
// PARITY: keep behaviour aligned with apps/astro/src/lib/parse-embeds.ts.

export type EmbedType = 'twitter' | 'instagram' | 'gallery' | 'brightcove';

export type Segment =
  | { kind: 'html'; html: string }
  | { kind: 'embed'; type: EmbedType; html: string };

interface Match {
  start: number;
  end: number;
  type: EmbedType;
  html: string;
}

const TWITTER_BLOCKQUOTE = /<blockquote\b[^>]*\bclass="[^"]*\btwitter-tweet\b[^"]*"[^>]*>/i;
const INSTAGRAM_BLOCKQUOTE = /<blockquote\b[^>]*\bclass="[^"]*\binstagram-media\b[^"]*"[^>]*>/i;
const GALLERY_DIV = /<div\b[^>]*\bclass="[^"]*\bwp-block-gallery\b[^"]*"[^>]*>/i;
const BRIGHTCOVE_COMMENT_START = /<!--\s*Start of Brightcove Player\s*-->/i;
const BRIGHTCOVE_COMMENT_END = /<!--\s*End of Brightcove Player\s*-->/i;

const TWITTER_TRAIL =
  /^\s*(?:<p>\s*)?<script\b[^>]*src="[^"]*platform\.twitter\.com[^"]*"[^>]*><\/script>(?:\s*<\/p>)?/i;
const INSTAGRAM_TRAIL =
  /^\s*<script\b[^>]*src="[^"]*instagram\.com\/embed\.js[^"]*"[^>]*><\/script>/i;

export function parseEmbeds(html: string): Segment[] {
  const segments: Segment[] = [];
  let pos = 0;
  while (pos < html.length) {
    const match = findNextEmbed(html, pos);
    if (!match) {
      const rest = html.slice(pos);
      if (rest.trim()) segments.push({ kind: 'html', html: rest });
      break;
    }
    if (match.start > pos) {
      const before = html.slice(pos, match.start);
      if (before.trim()) segments.push({ kind: 'html', html: before });
    }
    segments.push({ kind: 'embed', type: match.type, html: match.html });
    pos = match.end;
  }
  return segments;
}

function findNextEmbed(html: string, from: number): Match | null {
  const slice = html.slice(from);
  const candidates: Array<{
    type: EmbedType;
    idx: number;
    extract: (s: string, idx: number) => Match | null;
  }> = [
    {
      type: 'brightcove',
      idx: indexOrInf(slice, BRIGHTCOVE_COMMENT_START),
      extract: extractBrightcove,
    },
    {
      type: 'twitter',
      idx: indexOrInf(slice, TWITTER_BLOCKQUOTE),
      extract: (s, i) => extractBlockquote(s, i, 'twitter', TWITTER_TRAIL),
    },
    {
      type: 'instagram',
      idx: indexOrInf(slice, INSTAGRAM_BLOCKQUOTE),
      extract: (s, i) => extractBlockquote(s, i, 'instagram', INSTAGRAM_TRAIL),
    },
    { type: 'gallery', idx: indexOrInf(slice, GALLERY_DIV), extract: extractGallery },
  ];
  candidates.sort((a, b) => a.idx - b.idx);
  for (const c of candidates) {
    if (!Number.isFinite(c.idx)) return null;
    const m = c.extract(slice, c.idx);
    if (m) return { ...m, start: m.start + from, end: m.end + from };
  }
  return null;
}

function indexOrInf(slice: string, re: RegExp): number {
  const m = re.exec(slice);
  return m ? m.index : Number.POSITIVE_INFINITY;
}

function extractBlockquote(
  slice: string,
  start: number,
  type: EmbedType,
  trailRe: RegExp,
): Match | null {
  const close = findMatchingClose(slice, start, 'blockquote');
  if (close === -1) return null;
  let end = close;
  const trail = trailRe.exec(slice.slice(end));
  if (trail) end += trail.index + trail[0].length;
  return { start, end, type, html: slice.slice(start, close) };
}

function extractGallery(slice: string, start: number): Match | null {
  const close = findMatchingClose(slice, start, 'div');
  if (close === -1) return null;
  return { start, end: close, type: 'gallery', html: slice.slice(start, close) };
}

function extractBrightcove(slice: string, start: number): Match | null {
  const after = slice.slice(start);
  const endComment = BRIGHTCOVE_COMMENT_END.exec(after);
  if (!endComment) return null;
  const totalEnd = start + endComment.index + endComment[0].length;
  const block = slice.slice(start, totalEnd);
  // Strip the provider script — the BrightcoveEmbed component injects it at
  // mount time using the per-video data-account / data-player attrs.
  const stripped = block.replace(
    /<script\b[^>]*src="[^"]*players\.brightcove\.net[^"]*"[^>]*><\/script>/i,
    '',
  );
  return { start, end: totalEnd, type: 'brightcove', html: stripped };
}

function findMatchingClose(slice: string, start: number, tag: string): number {
  // Find the position just after the matching </tag> that closes the open tag
  // at `start`. Tracks nesting depth by scanning all <tag and </tag tokens past
  // the opening tag.
  const tokenRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  tokenRe.lastIndex = start;
  // Skip the opening tag at `start`
  const opener = tokenRe.exec(slice);
  if (!opener || opener.index !== start) return -1;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(slice)) !== null) {
    depth += m[1] === '/' ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return -1;
}
