// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { NavigationMenu } from './NavigationMenu';

describe('NavigationMenu', () => {
  afterEach(cleanup);

  it('renders all 7 hardcoded section links', () => {
    const { getByRole } = render(<NavigationMenu />);
    const expected = [
      'Middle East',
      'Asia Pacific',
      'US & Canada',
      'Europe',
      'Africa',
      'Latin America',
      'Opinion',
    ];
    for (const label of expected) {
      expect(getByRole('link', { name: label })).toBeTruthy();
    }
  });

  it('hamburger button toggles aria-expanded and the nav list visibility', () => {
    const { getByRole } = render(<NavigationMenu />);
    const btn = getByRole('button', { name: /menu/i });
    const list = getByRole('navigation').querySelector('ul')!;

    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(list.className).toContain('hidden');

    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(list.className).toContain('flex');
    expect(list.className).not.toContain('hidden');

    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(list.className).toContain('hidden');
  });
});
