export type Variables = Record<string, unknown>;

type SuffixBuilder = (variables: Variables) => string | null;

const VARIANT_RULES: Record<string, SuffixBuilder> = {
  ArchipelagoSingleArticleQuery: (v) =>
    typeof v.name === "string" ? `--${slugify(v.name)}` : null,

  ArchipelagoSingleLiveBlogQuery: (v) =>
    typeof v.name === "string" ? `--${slugify(v.name)}` : null,

  SingleLiveBlogChildrensQuery: (v) =>
    typeof v.postName === "string" ? `--${slugify(v.postName)}` : null,

  // Production signature verified by live probe 2026-04: (postID: Int!, postType: String!).
  LiveBlogUpdateQuery: (v) =>
    typeof v.postID === "number" ? `--${v.postID}` : null,

  ArchipelagoSectionQuery: (v) =>
    typeof v.name === "string" ? `--${slugify(v.name)}` : null,

  ArchipelagoAjeSectionPostsQuery: (v) =>
    typeof v.category === "string" && typeof v.offset === "number"
      ? `--${slugify(v.category)}--offset-${v.offset}`
      : null,

  ArchipelagoTopicsPageQuery: (v) =>
    typeof v.slug === "string" ? `--${slugify(v.slug)}` : null,

  ArchipelagoPaginatedTopicsFeedQuery: (v) =>
    typeof v.slug === "string" && typeof v.offset === "number"
      ? `--${slugify(v.slug)}--offset-${v.offset}`
      : null,
};

export class MissingVariableError extends Error {
  constructor(operationName: string) {
    super(`Operation '${operationName}' requires variant variables that are missing or wrongly typed`);
    this.name = "MissingVariableError";
  }
}

export function resolveFixtureKey(operationName: string, variables: Variables): string {
  const builder = VARIANT_RULES[operationName];
  if (!builder) return operationName;
  const suffix = builder(variables);
  if (!suffix) throw new MissingVariableError(operationName);
  return `${operationName}${suffix}`;
}

// Exported so scripts/record-fixtures.sh can be parity-tested against the same algorithm.
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
