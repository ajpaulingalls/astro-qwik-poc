// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { LiveBadge } from './LiveBadge';

describe('LiveBadge', () => {
  it('renders LIVE text and live-badge class when isLive is true', async () => {
    const { screen, render } = await createDOM();
    await render(<LiveBadge isLive={true} />);
    const badge = screen.querySelector('.live-badge')!;
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('LIVE');
    expect(badge.className).toContain('text-aj-orange');
    expect(badge.className).toContain('uppercase');
  });

  it('renders nothing when isLive is false', async () => {
    const { screen, render } = await createDOM();
    await render(<LiveBadge isLive={false} />);
    expect(screen.querySelector('.live-badge')).toBeFalsy();
  });

  it('renders nothing when isLive is undefined', async () => {
    const { screen, render } = await createDOM();
    await render(<LiveBadge />);
    expect(screen.querySelector('.live-badge')).toBeFalsy();
  });
});
