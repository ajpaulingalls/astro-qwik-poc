import type { APIRoute } from 'astro';
import { resolveApiBase } from '../../../lib/graphql';

// Same-origin proxy for /wp-content/uploads/* — forwards to the configured
// API base (mock-api in dev/perf, aljazeera.com in M11 demo). Lives in the
// Astro page tree so the Deno SSR adapter serves it without bespoke wrapper
// code; see apps/astro/docs/SECURITY.md for the why.
export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  // Forward the query string so resize hints (?w=, ?resize=) reach mock-api;
  // production WordPress uses these for server-side cropping and the new
  // SVG-placeholder branch in packages/mock-api/lib/handler.ts depends on it.
  const upstream = `${resolveApiBase()}/wp-content/uploads/${params.path}${url.search}`;
  const response = await fetch(upstream);
  return new Response(response.body, response);
};
