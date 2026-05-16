import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { Navigation } from './Navigation';

describe('Navigation editorial header', () => {
  it('renders an orange AJE logo block inside the home link', async () => {
    const { screen, render } = await createDOM();
    await render(<Navigation />);
    const home = screen.querySelector('a[href="/"]') as HTMLElement | null;
    expect(home).toBeTruthy();
    expect(home?.getAttribute('aria-label')).toBe('Al Jazeera English');
    const logo = home?.querySelector('span.bg-aj-orange') as HTMLElement | null;
    expect(logo).toBeTruthy();
    expect(logo?.textContent).toContain('AJE');
  });

  it('renders the AL JAZEERA wordmark visible at sm+ breakpoints', async () => {
    const { screen, render } = await createDOM();
    await render(<Navigation />);
    const home = screen.querySelector('a[href="/"]') as HTMLElement | null;
    const wordmark = Array.from(home?.querySelectorAll('span') ?? []).find((el) =>
      /AL\s+JAZEERA/i.test(el.textContent ?? ''),
    ) as HTMLElement | undefined;
    expect(wordmark).toBeTruthy();
    expect(wordmark?.className).toContain('hidden');
    expect(wordmark?.className).toContain('sm:inline');
    expect(wordmark?.textContent).toMatch(/English/i);
  });

  it('renders a LIVE pill aria-hidden with a red dot, visible at sm+', async () => {
    const { screen, render } = await createDOM();
    await render(<Navigation />);
    const livePill = Array.from(screen.querySelectorAll('span[aria-hidden="true"]')).find((el) =>
      (el.textContent ?? '').trim().includes('LIVE'),
    ) as HTMLElement | undefined;
    expect(livePill).toBeTruthy();
    expect(livePill?.className).toContain('bg-neutral-900');
    expect(livePill?.className).toContain('sm:inline-flex');
    expect(livePill?.querySelector('span.bg-red-500')).toBeTruthy();
  });

  it('renders a Search button stub with an accessible label', async () => {
    const { screen, render } = await createDOM();
    await render(<Navigation />);
    const search = screen.querySelector('button[aria-label="Search"]') as HTMLElement | null;
    expect(search).toBeTruthy();
    expect(search?.querySelector('svg')).toBeTruthy();
  });
});

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
