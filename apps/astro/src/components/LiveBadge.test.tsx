// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { LiveBadge } from './LiveBadge';

describe('LiveBadge', () => {
  afterEach(cleanup);

  it('renders LIVE text and live-badge class when isLive is true', () => {
    const { container } = render(<LiveBadge isLive={true} />);
    const badge = container.querySelector('.live-badge')!;
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('LIVE');
    expect(badge.className).toContain('text-aj-orange');
    expect(badge.className).toContain('uppercase');
  });

  it('renders nothing when isLive is false', () => {
    const { container } = render(<LiveBadge isLive={false} />);
    expect(container.querySelector('.live-badge')).toBeFalsy();
  });

  it('renders nothing when isLive is undefined', () => {
    const { container } = render(<LiveBadge />);
    expect(container.querySelector('.live-badge')).toBeFalsy();
  });
});
