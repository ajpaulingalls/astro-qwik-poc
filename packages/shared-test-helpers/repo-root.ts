// Resolved repo root path. Computed via import.meta.dirname rather than
// process.cwd() so test invocations from any subdirectory resolve to the same
// absolute path. Two segments up from packages/shared-test-helpers/ lands at
// the workspace root.
//
// A parallel REPO_ROOT exists at packages/perf-harness/spawn.ts:13 — production
// code shouldn't depend on a test-helpers package, so the duplication is the
// price. Both definitions assume their package lives at depth 2 from the repo
// root; the workspaces glob (`packages/*`) enforces that.
import { resolve } from 'node:path';

export const REPO_ROOT = resolve(import.meta.dirname, '../..');
