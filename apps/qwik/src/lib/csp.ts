// Thin runtime wrapper. Origins + Qwik-specific 'unsafe-inline' strategy
// live in packages/shared-csp/index.ts; the parity test there enforces
// origin equivalence with Astro. server.ts and vite.config.ts both
// import CSP from here so the header value is computed once at module
// load using the runtime PUBLIC_API_BASE (perf-harness sets 4456 for
// Qwik via spawn.ts; M11 prod will set https://… for the live demo).
import { buildQwikCsp, DEFAULT_API_BASE } from '@aje-poc/shared-csp';

const API_BASE = process.env.PUBLIC_API_BASE ?? DEFAULT_API_BASE;
export const CSP = buildQwikCsp(API_BASE);
