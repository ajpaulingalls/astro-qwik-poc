// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { LiveBadge } from './LiveBadge';

describe('LiveBadge', () => {
  afterEach(cleanup);

  it('renders LIVE when isLive is true', () => {
    const { container } = render(<LiveBadge isLive={true} />);
    const badge = container.querySelector('span.text-aj-orange')!;
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('LIVE');
  });

  it('renders nothing when isLive is false', () => {
    const { container } = render(<LiveBadge isLive={false} />);
    expect(container.querySelector('span.text-aj-orange')).toBeFalsy();
  });

  it('renders nothing when isLive is undefined', () => {
    const { container } = render(<LiveBadge />);
    expect(container.querySelector('span.text-aj-orange')).toBeFalsy();
  });
});
