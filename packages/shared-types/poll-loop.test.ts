import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPollLoop, POLL_DONE } from './index';

describe('createPollLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('calls tick on each interval and forwards non-null results to onResult', async () => {
    const tick = vi.fn(async () => 'value');
    const onResult = vi.fn();
    createPollLoop({
      tick,
      onResult,
      intervalMs: 100,
      maxConsecutiveEmpty: 5,
      label: 'test',
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith('value');

    await vi.advanceTimersByTimeAsync(100);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('stops the loop after maxConsecutiveEmpty null returns and logs once', async () => {
    const tick = vi.fn(async () => null);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    createPollLoop({
      tick,
      onResult: vi.fn(),
      intervalMs: 100,
      maxConsecutiveEmpty: 3,
      label: 'test',
    });
    await vi.advanceTimersByTimeAsync(100 * 3);
    expect(tick).toHaveBeenCalledTimes(3);
    expect(infoSpy).toHaveBeenCalledWith('test: stopping poll after 3 empty cycles');

    // Past the threshold the interval is cleared — further time advances
    // produce no new ticks.
    await vi.advanceTimersByTimeAsync(100 * 5);
    expect(tick).toHaveBeenCalledTimes(3);
    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it('calls onEmpty when tick returns null (so callers can clear displayed state)', async () => {
    let returnNull = false;
    const tick = vi.fn(async () => (returnNull ? null : 'value'));
    const onResult = vi.fn();
    const onEmpty = vi.fn();
    createPollLoop({
      tick,
      onResult,
      onEmpty,
      intervalMs: 100,
      maxConsecutiveEmpty: 5,
      label: 'test',
    });
    // First tick: non-null → onResult; onEmpty NOT called.
    await vi.advanceTimersByTimeAsync(100);
    expect(onResult).toHaveBeenCalledWith('value');
    expect(onEmpty).not.toHaveBeenCalled();
    // Second tick: null → onEmpty fires.
    returnNull = true;
    await vi.advanceTimersByTimeAsync(100);
    expect(onEmpty).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onEmpty when tick throws (only null returns trigger it)', async () => {
    const tick = vi.fn(async () => {
      throw new Error('boom');
    });
    const onEmpty = vi.fn();
    const onError = vi.fn();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    createPollLoop({
      tick,
      onResult: vi.fn(),
      onEmpty,
      onError,
      intervalMs: 100,
      maxConsecutiveEmpty: 3,
      label: 'test',
    });
    await vi.advanceTimersByTimeAsync(100 * 3);
    expect(onError).toHaveBeenCalledTimes(3);
    expect(onEmpty).not.toHaveBeenCalled();
  });

  it('treats thrown errors like empty (counts toward stop)', async () => {
    const error = new Error('upstream broken');
    const tick = vi.fn(async () => {
      throw error;
    });
    const onError = vi.fn();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    createPollLoop({
      tick,
      onResult: vi.fn(),
      onError,
      intervalMs: 100,
      maxConsecutiveEmpty: 3,
      label: 'test',
    });
    await vi.advanceTimersByTimeAsync(100 * 3);
    expect(onError).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenCalledWith(error);

    await vi.advanceTimersByTimeAsync(100 * 5);
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it('resets the empty counter when tick returns a non-null value', async () => {
    let returnNull = true;
    const tick = vi.fn(async () => (returnNull ? null : 'hit'));
    const onResult = vi.fn();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    createPollLoop({
      tick,
      onResult,
      intervalMs: 100,
      maxConsecutiveEmpty: 3,
      label: 'test',
    });
    // Two empty ticks (counter=2), then one success (counter=0), then two
    // more empty (counter=2) — should NOT stop because the threshold (3)
    // is never reached consecutively.
    await vi.advanceTimersByTimeAsync(100 * 2);
    expect(tick).toHaveBeenCalledTimes(2);
    returnNull = false;
    await vi.advanceTimersByTimeAsync(100);
    expect(onResult).toHaveBeenCalledWith('hit');
    returnNull = true;
    await vi.advanceTimersByTimeAsync(100 * 2);
    expect(tick).toHaveBeenCalledTimes(5);

    // One more empty would trip 3 consecutive.
    await vi.advanceTimersByTimeAsync(100);
    expect(tick).toHaveBeenCalledTimes(6);
    // And then no more.
    await vi.advanceTimersByTimeAsync(100 * 5);
    expect(tick).toHaveBeenCalledTimes(6);
  });

  it('skips tick when shouldSkip returns true (no counter change)', async () => {
    let hidden = true;
    const tick = vi.fn(async () => null);
    vi.spyOn(console, 'info').mockImplementation(() => {});
    createPollLoop({
      tick,
      onResult: vi.fn(),
      shouldSkip: () => hidden,
      intervalMs: 100,
      maxConsecutiveEmpty: 3,
      label: 'test',
    });
    // 5 cadences while hidden — tick never runs, counter never moves.
    await vi.advanceTimersByTimeAsync(100 * 5);
    expect(tick).not.toHaveBeenCalled();
    hidden = false;
    // Now ticks fire and trip the threshold.
    await vi.advanceTimersByTimeAsync(100 * 3);
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it('drops overlapping ticks while a previous tick is in flight (concurrency guard)', async () => {
    let resolveFirst: (() => void) | undefined;
    const firstPromise = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    let callCount = 0;
    const tick = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        await firstPromise;
        return 'first';
      }
      return 'later';
    });
    const onResult = vi.fn();
    createPollLoop({
      tick,
      onResult,
      intervalMs: 100,
      maxConsecutiveEmpty: 5,
      label: 'test',
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(tick).toHaveBeenCalledTimes(1);
    // Second cadence fires while tick 1 is still pending — guard skips it.
    await vi.advanceTimersByTimeAsync(100);
    expect(tick).toHaveBeenCalledTimes(1);
    resolveFirst!();
    await firstPromise;
    // Settle the awaiter chain so finally{} clears the polling flag.
    await vi.advanceTimersByTimeAsync(0);
    // Third cadence runs normally.
    await vi.advanceTimersByTimeAsync(100);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('calls tick once synchronously when immediate:true', async () => {
    const tick = vi.fn(async () => 'eager');
    const onResult = vi.fn();
    createPollLoop({
      tick,
      onResult,
      intervalMs: 1_000,
      maxConsecutiveEmpty: 5,
      label: 'test',
      immediate: true,
    });
    // No timer advance — the immediate call should already be in flight.
    await Promise.resolve();
    await Promise.resolve();
    expect(tick).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith('eager');
  });

  it('stops immediately when tick returns POLL_DONE (fast-stop, no waiting through max-empty)', async () => {
    const tick = vi.fn(async () => POLL_DONE);
    const onResult = vi.fn();
    const onEmpty = vi.fn();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    createPollLoop<string>({
      tick,
      onResult,
      onEmpty,
      intervalMs: 100,
      maxConsecutiveEmpty: 20,
      label: 'test',
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalled();
    expect(onEmpty).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith('test: stopping poll on POLL_DONE signal');
    expect(infoSpy).toHaveBeenCalledTimes(1);

    // Past the POLL_DONE the interval is cleared — further time advances
    // produce no new ticks.
    await vi.advanceTimersByTimeAsync(100 * 50);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it('stop() clears the interval so no further ticks fire', async () => {
    const tick = vi.fn(async () => 'value');
    const { stop } = createPollLoop({
      tick,
      onResult: vi.fn(),
      intervalMs: 100,
      maxConsecutiveEmpty: 5,
      label: 'test',
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(tick).toHaveBeenCalledTimes(1);
    stop();
    await vi.advanceTimersByTimeAsync(100 * 10);
    expect(tick).toHaveBeenCalledTimes(1);
  });
});
