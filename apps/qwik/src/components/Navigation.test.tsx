import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { Navigation } from './Navigation';

describe('Navigation', () => {
  it('renders all 7 hardcoded section links in order', async () => {
    const { screen, render } = await createDOM();
    await render(<Navigation />);
    const links = screen.querySelectorAll('nav ul a');
    const labels = [
      'Middle East',
      'Asia Pacific',
      'US & Canada',
      'Europe',
      'Africa',
      'Latin America',
      'Opinion',
    ];
    expect(links).toHaveLength(labels.length);
    labels.forEach((label, i) => {
      expect(links[i].textContent).toBe(label);
    });
  });

  it('hamburger button toggles aria-expanded and the nav list visibility', async () => {
    const { screen, render, userEvent } = await createDOM();
    await render(<Navigation />);
    const btn = screen.querySelector('button[aria-label="Menu"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    const list = screen.querySelector('nav ul') as HTMLUListElement;
    expect(list.className).toContain('hidden');

    await userEvent('button[aria-label="Menu"]', 'click');
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(list.className).toContain('flex');
    expect(list.className).not.toContain('hidden');

    await userEvent('button[aria-label="Menu"]', 'click');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(list.className).toContain('hidden');
  });
});
