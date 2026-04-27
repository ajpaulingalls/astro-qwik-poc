// Production-equivalent Node server for Qwik 2 perf-harness parity with
// Astro (which spawns `deno run dist/server/entry.mjs` directly). The
// bundled `server/entry.preview.js` exports a QwikRouterNodeMiddleware
// object — handlers, not a listener — so it must be wrapped in an http
// server. See @qwik.dev/router/middleware/node.d.ts.
//
// Why we hand-roll static-file serving instead of using middleware.staticFile:
// the bundled handler resolves `static.root` against an unintended base
// (`apps/qwik/server/dist/...` instead of `apps/qwik/dist/...`) even when
// passed an absolute path through `createQwikRouter({ static: { root } })`.
// Verified empirically — `staticFile` returned 500 with `ENOENT: no such
// file or directory, open 'apps/qwik/server/dist/build/q-*.js'`. Until
// Qwik 2 stabilizes this, hand-roll. The 14-line MIME table covers
// everything the current build emits; chunks beyond it would 500 visibly.
//
// `statSync` is fine for perf-harness load (a handful of requests per
// run). For real production traffic, switch to `fs.promises.stat` + an
// async fall-through to the router.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import middleware from './server/entry.preview.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_ROOT = resolve(__dirname, 'dist');

const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 4173);
// Same-origin proxy target for /wp-content/uploads/* — see vite.config.ts
// for the dev/preview equivalent and docs/QWIK2_NOTES.md for the why.
const API_BASE = process.env.PUBLIC_API_BASE ?? 'http://localhost:4455';

const MIME: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

// Astro's proxy forwards the entire upstream response via `new Response(body, response)`,
// and the Deno runtime strips hop-by-hop headers at the wire boundary. We hand-build
// headers for Node's http server, so we have to do the stripping ourselves. RFC 7230 §6.1.
//
// content-encoding + content-length also need stripping: fetch() transparently decodes
// gzip/br responses and exposes the DECODED bytes via upstream.body. Forwarding the
// original encoding header would tell the downstream client to decode again →
// Z_DATA_ERROR. Bytes-after-decode also differ from the upstream-declared length.
const STRIP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-encoding',
  'content-length',
]);

async function tryProxyUploads(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url ?? '/';
  if (!url.startsWith('/wp-content/uploads/')) return false;
  try {
    const upstream = await fetch(`${API_BASE}${url}`);
    const headers: Record<string, string> = {};
    // Headers iteration yields lowercased names per WHATWG; no toLowerCase needed.
    upstream.headers.forEach((value, name) => {
      if (!STRIP_HEADERS.has(name)) headers[name] = value;
    });
    res.writeHead(upstream.status, headers);
    if (!upstream.body) {
      res.end();
      return true;
    }
    // pipeline destroys both streams on either-side error/close, so a client
    // disconnect mid-image releases the upstream socket back to undici's pool.
    await pipeline(Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]), res);
  } catch (err) {
    fail(res, err);
  }
  return true;
}

function tryServeStatic(req: IncomingMessage, res: ServerResponse): boolean {
  const url = req.url ?? '/';
  if (!url.startsWith('/build/') && !url.startsWith('/assets/')) return false;
  const safe = normalize(url).replace(/^\/+/, '');
  const filePath = join(DIST_ROOT, safe);
  // Containment check defends against ../ traversal even though normalize() handles it.
  if (!filePath.startsWith(DIST_ROOT)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return true;
  }
  let stats;
  try {
    stats = statSync(filePath);
  } catch {
    return false;
  }
  if (!stats.isFile()) return false;
  res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream');
  res.setHeader('Content-Length', String(stats.size));
  // Propagate read errors so the request fails loud instead of hanging until
  // socket idle timeout — pipe alone does not forward source errors to dest.
  createReadStream(filePath)
    .on('error', (err) => fail(res, err))
    .pipe(res);
  return true;
}

function fail(res: ServerResponse, err: unknown): void {
  // Qwik's router writes its own 500 page on internal errors then calls
  // next(err) — guard against double-write to a closed response.
  if (res.writableEnded) return;
  res.statusCode = 500;
  res.end(String(err));
}

createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (await tryProxyUploads(req, res)) return;
  if (tryServeStatic(req, res)) return;
  middleware.router(req, res, (err?: unknown) => {
    if (err) fail(res, err);
  });
}).listen(PORT, HOST, () => {
  process.stdout.write(`qwik prod listening on http://${HOST}:${PORT}\n`);
});
