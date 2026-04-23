// Browser acceptance suite is shared with Qwik in
// packages/perf-harness/acceptance.ts so the two apps render the same UI
// against the same assertions — any divergence is a code bug, not a test
// asymmetry. This file is the Astro entry point.
import { runAcceptanceSuite } from '@aje-poc/perf-harness/acceptance';

runAcceptanceSuite('astro');
