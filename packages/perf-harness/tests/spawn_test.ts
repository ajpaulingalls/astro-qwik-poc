import { describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { deriveAllowNet, killService, qwikSpawnEnv } from '../spawn.ts';

// Pins killService invariants — proc.exitCode is read once, kill is sent once.

function spyKill(proc: ChildProcess): { count: () => number } {
  let calls = 0;
  const real = proc.kill.bind(proc);
  proc.kill = ((sig?: NodeJS.Signals | number) => {
    calls++;
    return real(sig);
  }) as ChildProcess['kill'];
  return { count: () => calls };
}

describe('killService', () => {
  it('resolves immediately when proc has already exited (no kill sent)', async () => {
    const proc = spawn('node', ['-e', 'process.exit(0)']);
    await new Promise<void>((r) => proc.once('exit', () => r()));
    expect(proc.exitCode).not.toBeNull();

    const spy = spyKill(proc);
    await killService(proc);
    expect(spy.count()).toBe(0);
  });

  it('SIGTERMs a long-running child and resolves on exit', async () => {
    const proc = spawn('node', ['-e', 'setInterval(() => {}, 1000)']);
    expect(proc.exitCode).toBeNull();

    const spy = spyKill(proc);
    await killService(proc);
    expect(proc.signalCode).toBe('SIGTERM');
    expect(spy.count()).toBe(1);
  });

  it('reads proc.exitCode exactly once on the alive path', async () => {
    // Pins single-read invariant: re-introducing a second exitCode check
    // inside the executor would fail this test. Real ChildProcess cannot
    // transition exitCode mid-executor (synchronous), so a second check
    // would be dead code.
    const events = new EventEmitter();
    let reads = 0;
    const mock = {
      get exitCode(): number | null {
        reads++;
        return null;
      },
      kill() {
        return true;
      },
      once(ev: string, cb: () => void) {
        events.once(ev, cb);
        return this;
      },
    } as unknown as ChildProcess;

    const promise = killService(mock);
    events.emit('exit');
    await promise;

    expect(reads).toBe(1);
  });

  it('always sends one SIGTERM under spawn-and-immediately-kill stress', async () => {
    // Race probe: 200 sequential spawn → killService cycles. Sequential
    // (not parallel) so each iteration probes the OS-scheduling race
    // between spawn-completion and our synchronous kill, not interleaved.
    const trials = 200;
    let killSkipped = 0;
    for (let i = 0; i < trials; i++) {
      const proc = spawn('node', ['-e', 'process.exit(0)']);
      expect(proc.exitCode).toBeNull();
      const spy = spyKill(proc);
      await killService(proc);
      if (spy.count() === 0) killSkipped++;
    }
    expect(killSkipped).toBe(0);
  });
});

describe('deriveAllowNet', () => {
  // Pinned mock-api default: see spawn.ts MOCK_API_PORT.astro = 4455.
  it('defaults to localhost:4455 when PUBLIC_API_BASE is unset', () => {
    expect(deriveAllowNet(undefined, 8080)).toBe('0.0.0.0:8080,localhost:4455');
  });

  it('preserves localhost when PUBLIC_API_BASE explicitly points at the mock', () => {
    expect(deriveAllowNet('http://localhost:4455', 8080)).toBe('0.0.0.0:8080,localhost:4455');
  });

  it('derives https default port (443) when PUBLIC_API_BASE has no explicit port', () => {
    expect(deriveAllowNet('https://www.aljazeera.com', 8080)).toBe(
      '0.0.0.0:8080,www.aljazeera.com:443',
    );
  });

  it('honors explicit port in PUBLIC_API_BASE over the scheme default', () => {
    expect(deriveAllowNet('http://example.com:9000', 8080)).toBe('0.0.0.0:8080,example.com:9000');
  });

  it('derives http default port (80) when PUBLIC_API_BASE has no explicit port', () => {
    expect(deriveAllowNet('http://example.com', 8080)).toBe('0.0.0.0:8080,example.com:80');
  });

  it('throws naming the bad value when PUBLIC_API_BASE is malformed', () => {
    expect(() => deriveAllowNet('not-a-url', 8080)).toThrow(/not-a-url/);
  });

  it('rejects PUBLIC_API_BASE with whitespace via assertSafeApiBase', () => {
    expect(() => deriveAllowNet(' http://x.com', 8080)).toThrow(/apiBase contains/);
  });
});

describe('qwikSpawnEnv', () => {
  it('defaults PUBLIC_API_BASE to localhost:4456 when caller env is unset', () => {
    const env = qwikSpawnEnv({ FOO: 'bar' });
    expect(env.PUBLIC_API_BASE).toBe('http://localhost:4456');
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.PORT).toBe('4173');
    expect(env.FOO).toBe('bar'); // caller env passes through
  });

  it('honors caller PUBLIC_API_BASE', () => {
    const env = qwikSpawnEnv({ PUBLIC_API_BASE: 'https://www.aljazeera.com' });
    expect(env.PUBLIC_API_BASE).toBe('https://www.aljazeera.com');
  });

  it('treats empty PUBLIC_API_BASE as unset and falls back to localhost', () => {
    const env = qwikSpawnEnv({ PUBLIC_API_BASE: '' });
    expect(env.PUBLIC_API_BASE).toBe('http://localhost:4456');
  });

  it('rejects PUBLIC_API_BASE with whitespace via assertSafeApiBase (parity with deriveAllowNet)', () => {
    expect(() => qwikSpawnEnv({ PUBLIC_API_BASE: ' http://x.com' })).toThrow(/apiBase contains/);
  });
});
