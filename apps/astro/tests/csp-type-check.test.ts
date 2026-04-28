// Structural assertion + type-contract documentation for buildAstroCspConfig.
//
// What's actually enforced where:
//   - Runtime shape: this test's `expect(...)` calls fail loudly if the
//     builder ever stops emitting { scriptDirective: { resources }, directives }.
//   - Type-shape against Astro: enforced by astro.config.mjs (which has
//     `// @ts-check` and assigns `csp: buildAstroCspConfig(...)` directly).
//     Astro's build runs tsc against config files, so a drift in Astro's
//     `security.csp` shape vs our builder's return type fails the build.
//
// The `_astroAssignable` line below is documentation, NOT enforcement.
// Vitest doesn't run tsc by default (no typecheck config), so it would
// pass even if the type assignment were wrong. Its job is to make the
// contract visible at the test boundary and give the next dev a single
// place to update the type expectation when bumping Astro.
//
// Companion to packages/shared-csp/index.test.ts which does the cross-app
// shape-parity tests but cannot type-import Astro without pulling astro
// into shared-csp's deps. This file lives in apps/astro where astro is
// already installed.

import { describe, it, expect } from 'vitest';
import type { AstroUserConfig } from 'astro';
import { buildAstroCspConfig } from '@aje-poc/shared-csp';

type AstroCspField = NonNullable<NonNullable<AstroUserConfig['security']>['csp']>;

describe('buildAstroCspConfig type contract', () => {
  it('returns the runtime shape Astro consumes (scriptDirective + directives)', () => {
    const result = buildAstroCspConfig('http://localhost:4455');

    // Documentation of the type contract — see file header for why this
    // is documentation rather than enforcement.
    const _astroAssignable: AstroCspField = result;
    void _astroAssignable;

    // Runtime check: the structural shape Astro reads at build time.
    expect(result).toHaveProperty('scriptDirective');
    expect(result.scriptDirective).toHaveProperty('resources');
    expect(Array.isArray(result.scriptDirective.resources)).toBe(true);
    expect(result).toHaveProperty('directives');
    expect(Array.isArray(result.directives)).toBe(true);
    expect(result.directives.length).toBeGreaterThan(0);
  });
});
