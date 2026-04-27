import { describe, it, expect } from 'vitest';
import { buildAstroCspConfig, buildQwikCsp, FRAME_SRC_ORIGINS, SCRIPT_SRC_ORIGINS } from './index';

const API_BASE = 'http://localhost:4455';

// Parse a flat directive string ("name v1 v2 v3") into [name, sources[]].
// Used for both the Qwik joined-string format and individual Astro entries.
function parseDirective(text: string): { name: string; sources: string[] } {
  const [name, ...sources] = text.trim().split(/\s+/).filter(Boolean);
  return { name: name ?? '', sources };
}

function parseAstroDirective(astroDirectives: string[], name: string): string[] {
  const found = astroDirectives.find((d) => d.startsWith(`${name} `) || d === name);
  if (!found) throw new Error(`astro directive '${name}' not found`);
  return parseDirective(found).sources;
}

function parseQwikDirective(qwikCsp: string, name: string): string[] {
  const piece = qwikCsp
    .split(';')
    .find((p) => p.trim().startsWith(`${name} `) || p.trim() === name);
  if (!piece) throw new Error(`qwik directive '${name}' not found`);
  return parseDirective(piece).sources;
}

describe('shared-csp', () => {
  it('exposes the canonical origin constants', () => {
    // Twitter widgets render to BOTH platform.twitter.com and
    // syndication.twitter.com — both must be in frame-src.
    expect(FRAME_SRC_ORIGINS).toContain('https://platform.twitter.com');
    expect(FRAME_SRC_ORIGINS).toContain('https://syndication.twitter.com');
    expect(SCRIPT_SRC_ORIGINS).toContain('https://platform.twitter.com');
  });

  it('Astro and Qwik agree on the frame-src origin SET', () => {
    const astro = buildAstroCspConfig(API_BASE);
    const qwik = buildQwikCsp(API_BASE);
    const astroFrameSrc = new Set(parseAstroDirective(astro.directives, 'frame-src'));
    const qwikFrameSrc = new Set(parseQwikDirective(qwik, 'frame-src'));
    expect(astroFrameSrc).toEqual(qwikFrameSrc);
    expect(astroFrameSrc).toEqual(new Set(FRAME_SRC_ORIGINS));
  });

  it('Astro and Qwik agree on the script-src origin SET (excluding strategy tokens)', () => {
    const astro = buildAstroCspConfig(API_BASE);
    const qwik = buildQwikCsp(API_BASE);
    // Astro script-src: scriptDirective.resources contains 'self' + origins
    const astroScriptOrigins = new Set(
      astro.scriptDirective.resources.filter((r) => r !== "'self'"),
    );
    // Qwik script-src directive: 'self' + 'unsafe-inline' + origins
    const qwikScriptOrigins = new Set(
      parseQwikDirective(qwik, 'script-src').filter(
        (s) => s !== "'self'" && s !== "'unsafe-inline'",
      ),
    );
    expect(astroScriptOrigins).toEqual(qwikScriptOrigins);
    expect(astroScriptOrigins).toEqual(new Set(SCRIPT_SRC_ORIGINS));
  });

  it('Astro and Qwik agree on the img-src and connect-src origin SETS (with apiBase substituted)', () => {
    const astro = buildAstroCspConfig(API_BASE);
    const qwik = buildQwikCsp(API_BASE);
    const astroImg = new Set(parseAstroDirective(astro.directives, 'img-src'));
    const qwikImg = new Set(parseQwikDirective(qwik, 'img-src'));
    expect(astroImg).toEqual(qwikImg);
    expect(astroImg).toContain(API_BASE);
    const astroConnect = new Set(parseAstroDirective(astro.directives, 'connect-src'));
    const qwikConnect = new Set(parseQwikDirective(qwik, 'connect-src'));
    expect(astroConnect).toEqual(qwikConnect);
    expect(astroConnect).toContain(API_BASE);
  });

  it('Astro and Qwik agree on default-src and font-src directives', () => {
    const astro = buildAstroCspConfig(API_BASE);
    const qwik = buildQwikCsp(API_BASE);
    expect(parseAstroDirective(astro.directives, 'default-src')).toEqual(
      parseQwikDirective(qwik, 'default-src'),
    );
    expect(parseAstroDirective(astro.directives, 'font-src')).toEqual(
      parseQwikDirective(qwik, 'font-src'),
    );
  });

  it('Astro config does NOT use unsafe-inline (auto-hash strategy via Astro 6 scriptDirective)', () => {
    const astro = buildAstroCspConfig(API_BASE);
    const allText = JSON.stringify(astro);
    expect(allText).not.toContain("'unsafe-inline'");
  });

  it('Qwik config DOES use unsafe-inline on script-src and style-src (Qwik 2 beta limitation)', () => {
    const qwik = buildQwikCsp(API_BASE);
    expect(parseQwikDirective(qwik, 'script-src')).toContain("'unsafe-inline'");
    expect(parseQwikDirective(qwik, 'style-src')).toContain("'unsafe-inline'");
  });

  it('apiBase substitution leaves no hardcoded default leak', () => {
    // Positive substitution is covered by the img-src/connect-src parity test;
    // this test asserts the negative — no leftover localhost:4455 leaks
    // through when the caller passes a different apiBase.
    const customApiBase = 'https://api.example.test';
    const astro = buildAstroCspConfig(customApiBase);
    const qwik = buildQwikCsp(customApiBase);
    expect(JSON.stringify(astro)).not.toContain('localhost:4455');
    expect(qwik).not.toContain('localhost:4455');
  });
});
