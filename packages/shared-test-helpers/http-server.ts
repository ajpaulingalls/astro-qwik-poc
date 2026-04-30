import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface TestServerResponse {
  status: number;
  body: string;
  headers?: Record<string, string>;
}

export interface TestServerHandle {
  url: string;
  close: () => Promise<void>;
}

// Spins up a node http server bound to an ephemeral 127.0.0.1 port. The
// handler is called per-request with a 1-based count so tests that need
// deterministic alternation (e.g. every-other-500) can build it from the
// counter without per-test mutable state.
export async function startTestServer(
  handler: (count: number) => TestServerResponse,
): Promise<TestServerHandle> {
  let count = 0;
  const server: Server = createServer((_req, res) => {
    count += 1;
    const { status, body, headers } = handler(count);
    res.writeHead(status, { 'content-type': 'text/plain', ...headers });
    res.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  // listen(0, '127.0.0.1', cb) is guaranteed to yield AddressInfo with a port.
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}
