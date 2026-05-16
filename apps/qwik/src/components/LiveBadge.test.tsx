// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { LiveBadge } from './LiveBadge';

describe('LiveBadge', () => {
  it('renders LIVE when isLive is true', async () => {
    const { screen, render } = await createDOM();
    await render(<LiveBadge isLive={true} />);
    const badge = screen.querySelector('span.text-aj-orange')!;
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('LIVE');
  });

  it('renders nothing when isLive is false', async () => {
    const { screen, render } = await createDOM();
    await render(<LiveBadge isLive={false} />);
    expect(screen.querySelector('span.text-aj-orange')).toBeFalsy();
  });

  it('renders nothing when isLive is undefined', async () => {
    const { screen, render } = await createDOM();
    await render(<LiveBadge />);
    expect(screen.querySelector('span.text-aj-orange')).toBeFalsy();
  });

  it('defaults to small typography (text-xs font-bold tracking-wider)', async () => {
    const { screen, render } = await createDOM();
    await render(<LiveBadge isLive={true} />);
    const badge = screen.querySelector('span.text-aj-orange')!;
    expect(badge.className).toContain('text-xs');
    expect(badge.className).toContain('font-bold');
    expect(badge.className).toContain('tracking-wider');
  });

  it('opts into display typography when size="lg" (text-sm font-extrabold tracking-widest)', async () => {
    const { screen, render } = await createDOM();
    await render(<LiveBadge isLive={true} size="lg" />);
    const badge = screen.querySelector('span.text-aj-orange')!;
    expect(badge.className).toContain('text-sm');
    expect(badge.className).toContain('font-extrabold');
    expect(badge.className).toContain('tracking-widest');
  });
});
