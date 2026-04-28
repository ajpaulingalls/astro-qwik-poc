export type Variables = Record<string, unknown>;

interface VariantRule {
  // Returns the suffix appended after the operationName (including the leading
  // `--`), or null if required variables are missing/wrongly-typed.
  suffix: (variables: Variables) => string | null;
  // When true, resolveFixtureKey will look for `--snapshot-N` variants on disk
  // and append `--snapshot-{deps.snapshotIndex(maxN)}` if any exist. Used for
  // live-blog operations that rotate over time.
  snapshotted?: boolean;
}

const VARIANT_RULES: Record<string, VariantRule> = {
  ArchipelagoSingleArticleQuery: {
    suffix: (v) => typeof v.name === "string" ? `--${slugify(v.name)}` : null,
  },

  ArchipelagoSingleLiveBlogQuery: {
    suffix: (v) => typeof v.name === "string" ? `--${slugify(v.name)}` : null,
    snapshotted: true,
  },

  SingleLiveBlogChildrensQuery: {
    suffix: (v) =>
      typeof v.postName === "string" ? `--${slugify(v.postName)}` : null,
    snapshotted: true,
  },

  // Production signature verified by live probe 2026-04:
  // (postID: Int!, postType: String! = "liveblog-update", preview: String!, isAmp: Boolean!).
  // Only postID drives the fixture filename — the others are required by the
  // upstream resolver but don't fan out fixtures.
  LiveBlogUpdateQuery: {
    suffix: (v) => typeof v.postID === "number" ? `--${v.postID}` : null,
  },

  ArchipelagoSectionQuery: {
    suffix: (v) => typeof v.name === "string" ? `--${slugify(v.name)}` : null,
  },

  ArchipelagoAjeSectionPostsQuery: {
    suffix: (v) =>
      typeof v.category === "string" && typeof v.offset === "number"
        ? `--${slugify(v.category)}--offset-${v.offset}`
        : null,
  },

  ArchipelagoTopicsPageQuery: {
    suffix: (v) => typeof v.slug === "string" ? `--${slugify(v.slug)}` : null,
  },

  ArchipelagoPaginatedTopicsFeedQuery: {
    suffix: (v) =>
      typeof v.slug === "string" && typeof v.offset === "number"
        ? `--${slugify(v.slug)}--offset-${v.offset}`
        : null,
  },
};

export interface VariantDeps {
  hasFixture: (key: string) => boolean;
  snapshotIndex: (maxN: number) => number;
}

export class MissingVariableError extends Error {
  constructor(operationName: string) {
    super(
      `Operation '${operationName}' requires variant variables that are missing or wrongly typed`,
    );
    this.name = "MissingVariableError";
  }
}

export function resolveFixtureKey(
  operationName: string,
  variables: Variables,
  deps?: VariantDeps,
): string {
  const rule = VARIANT_RULES[operationName];
  if (!rule) return operationName;
  const suffix = rule.suffix(variables);
  if (!suffix) throw new MissingVariableError(operationName);
  const baseKey = `${operationName}${suffix}`;

  if (deps && rule.snapshotted) {
    const maxN = countSnapshots(baseKey, deps.hasFixture);
    if (maxN > 0) {
      return `${baseKey}--snapshot-${deps.snapshotIndex(maxN)}`;
    }
  }
  return baseKey;
}

function countSnapshots(
  baseKey: string,
  hasFixture: (key: string) => boolean,
): number {
  let n = 0;
  while (hasFixture(`${baseKey}--snapshot-${n}`)) n++;
  return n;
}

// Exported so scripts/record-fixtures.sh can be parity-tested against the same algorithm.
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
