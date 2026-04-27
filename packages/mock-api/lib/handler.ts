import { type FixtureMap } from "./fixtures.ts";
import {
  MissingVariableError,
  resolveFixtureKey,
  type Variables,
} from "./variants.ts";

export interface HandlerDeps {
  fixtures: FixtureMap;
}

const CORS_HEADERS: HeadersInit = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "wp-site, content-type",
};

// 1x1 transparent PNG (67 bytes). Served for any /wp-content/uploads/* request so
// perf-harness LCP measurements don't time out on a 404. We don't ship realistic
// fixture images yet — production media live on a CDN; this lets Lighthouse complete
// honestly without fabricating image-decode data.
const PLACEHOLDER_PNG = Uint8Array.from([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  0x00,
  0x00,
  0x00,
  0x0d,
  0x49,
  0x48,
  0x44,
  0x52,
  0x00,
  0x00,
  0x00,
  0x01,
  0x00,
  0x00,
  0x00,
  0x01,
  0x08,
  0x00,
  0x00,
  0x00,
  0x00,
  0x3a,
  0x7e,
  0x9b,
  0x55,
  0x00,
  0x00,
  0x00,
  0x0a,
  0x49,
  0x44,
  0x41,
  0x54,
  0x78,
  0x9c,
  0x63,
  0x00,
  0x00,
  0x00,
  0x02,
  0x00,
  0x01,
  0xe2,
  0x21,
  0xbc,
  0x33,
  0x00,
  0x00,
  0x00,
  0x00,
  0x49,
  0x45,
  0x4e,
  0x44,
  0xae,
  0x42,
  0x60,
  0x82,
]);

export function handle(req: Request, deps: HandlerDeps): Response {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return text(405, `Method not allowed: ${req.method}`);
  }

  const url = new URL(req.url);

  if (url.pathname.startsWith("/wp-content/uploads/")) {
    const dims = parseResizeParams(url.searchParams);
    if (dims) {
      const { width, height } = dims;
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#ccc"/></svg>`;
      return new Response(svg, {
        status: 200,
        headers: { ...CORS_HEADERS, "content-type": "image/svg+xml" },
      });
    }
    return new Response(PLACEHOLDER_PNG, {
      status: 200,
      headers: { ...CORS_HEADERS, "content-type": "image/png" },
    });
  }

  if (url.pathname !== "/graphql") {
    return text(404, `Not found: ${url.pathname}`);
  }

  if (!req.headers.get("wp-site")) {
    return text(400, "Missing wp-site header");
  }

  const operationName = url.searchParams.get("operationName");
  if (!operationName) {
    return text(400, "Missing operationName");
  }

  let variables: Variables = {};
  const rawVariables = url.searchParams.get("variables");
  if (rawVariables) {
    try {
      variables = JSON.parse(rawVariables) as Variables;
    } catch {
      return text(400, `Invalid variables JSON: ${rawVariables}`);
    }
  }

  let key: string;
  try {
    key = resolveFixtureKey(operationName, variables);
  } catch (err) {
    if (err instanceof MissingVariableError) {
      return text(400, err.message);
    }
    throw err;
  }

  const fixture = deps.fixtures.get(key);
  if (fixture === undefined) {
    return text(
      404,
      `Unknown operation: ${operationName} (no fixture for key '${key}')`,
    );
  }

  return new Response(fixture, {
    status: 200,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

function text(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, "content-type": "text/plain" },
  });
}

// Production WordPress backend serves /wp-content/uploads/* with optional
// ?w=N (target width) and ?resize=W,H (cropped output dimensions). When the
// caller asks for a specific size we honor it with an SVG placeholder so
// LeadImage's srcset emits resolvable URLs and dev preview matches the
// production layout. Bare requests (no params) keep the 1x1 PNG path so
// existing acceptance probes that assert image/png continue to pass.
function parseResizeParams(
  params: URLSearchParams,
): { width: number; height: number } | null {
  const wRaw = params.get("w");
  const resize = params.get("resize");
  if (!wRaw && !resize) return null;

  if (resize) {
    const [wStr, hStr] = resize.split(",");
    const w = Number(wStr);
    const h = Number(hStr);
    if (Number.isInteger(w) && w > 0 && Number.isInteger(h) && h > 0) {
      return { width: w, height: h };
    }
  }

  if (wRaw) {
    const w = Number(wRaw);
    if (Number.isInteger(w) && w > 0) {
      return { width: w, height: w };
    }
  }

  return null;
}
