// Snapshot fixtures key off the slug's last segment, so the perf-harness CLI
// page list and the acceptance suite URL must always resolve to the same post.

export const LIVEBLOG_SLUG =
  '2026/4/22/iran-war-live-trump-says-ceasefire-extended-as-talks-with-tehran-in-limbo';

export const LIVEBLOG_PATH = `/news/liveblog/${LIVEBLOG_SLUG}`;
