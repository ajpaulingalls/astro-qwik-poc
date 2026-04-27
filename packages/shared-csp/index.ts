// Stub — implementation lands in T2 (GREEN phase).
// Tests in index.test.ts must fail until the two builders + two origin
// constants are implemented below.

export const FRAME_SRC_ORIGINS: readonly string[] = [];
export const SCRIPT_SRC_ORIGINS: readonly string[] = [];

export function buildAstroCspConfig(apiBase: string): {
  scriptDirective: { resources: string[] };
  directives: string[];
} {
  void apiBase;
  throw new Error('not implemented');
}

export function buildQwikCsp(apiBase: string): string {
  void apiBase;
  throw new Error('not implemented');
}
