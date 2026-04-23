import { describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { killService } from '../spawn.ts';

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
