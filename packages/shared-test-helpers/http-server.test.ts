import { describe, it, expect } from 'vitest';
import { startTestServer } from './http-server.ts';

describe('startTestServer', () => {
  it('starts on an ephemeral 127.0.0.1 port and returns a fetchable url', async () => {
    const { url, close } = await startTestServer(() => ({ status: 200, body: 'hello' }));
    try {
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
      const res = await fetch(url);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('hello');
    } finally {
      await close();
    }
  });

  it('passes a per-request count starting at 1 to the handler', async () => {
    const { url, close } = await startTestServer((n) => ({ status: 200, body: String(n) }));
    try {
      const a = await (await fetch(url)).text();
      const b = await (await fetch(url)).text();
      const c = await (await fetch(url)).text();
      expect([a, b, c]).toEqual(['1', '2', '3']);
    } finally {
      await close();
    }
  });

  it('honors a handler-supplied status code', async () => {
    const { url, close } = await startTestServer(() => ({ status: 503, body: 'down' }));
    try {
      const res = await fetch(url);
      expect(res.status).toBe(503);
    } finally {
      await close();
    }
  });

  it('honors handler-supplied headers (overrides default content-type)', async () => {
    const { url, close } = await startTestServer(() => ({
      status: 200,
      body: '<html></html>',
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }));
    try {
      const res = await fetch(url);
      expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    } finally {
      await close();
    }
  });

  it('defaults content-type to text/plain when no headers supplied', async () => {
    const { url, close } = await startTestServer(() => ({ status: 200, body: 'plain' }));
    try {
      const res = await fetch(url);
      expect(res.headers.get('content-type')).toMatch(/text\/plain/);
    } finally {
      await close();
    }
  });

  it('close() releases the port', async () => {
    const { url, close } = await startTestServer(() => ({ status: 200, body: 'ok' }));
    await close();
    await expect(fetch(url)).rejects.toThrow();
  });
});
