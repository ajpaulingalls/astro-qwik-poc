// Browser acceptance suite is shared with Astro in
// packages/perf-harness/acceptance.ts so the two apps render the same UI
// against the same assertions — any divergence is a code bug, not a test
// asymmetry. This file is the Qwik entry point.
import { runAcceptanceSuite } from '@aje-poc/perf-harness/acceptance';

runAcceptanceSuite('qwik');
