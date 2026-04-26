import { describe, it, expect } from 'vitest';
import { component$ } from '@qwik.dev/core';
import { createDOM } from '@qwik.dev/core/testing';
import { getByHeading } from './dom';

const Page = component$(() => (
  <div>
    <h2>Iran war live</h2>
    <h3>Lebanon update</h3>
    <h3>Yemen aid corridor</h3>
  </div>
));

describe('getByHeading', () => {
  it('finds the only h2 by name (regex match)', async () => {
    const { screen, render } = await createDOM();
    await render(<Page />);
    const h2 = getByHeading(screen, 2, /Iran war live/i);
    expect(h2.tagName).toBe('H2');
  });

  it('finds an h3 among multiple by name (regex match)', async () => {
    const { screen, render } = await createDOM();
    await render(<Page />);
    const h3 = getByHeading(screen, 3, /Lebanon update/i);
    expect(h3.tagName).toBe('H3');
    expect(h3.textContent).toContain('Lebanon update');
  });

  it('accepts a plain string substring matcher', async () => {
    const { screen, render } = await createDOM();
    await render(<Page />);
    const h3 = getByHeading(screen, 3, 'Yemen');
    expect(h3.textContent).toContain('Yemen aid corridor');
  });

  it('throws (not silent return) when no heading at the given level matches', async () => {
    const { screen, render } = await createDOM();
    await render(<Page />);
    expect(() => getByHeading(screen, 1, /missing/i)).toThrow(/no <h1>/);
    expect(() => getByHeading(screen, 2, /missing/i)).toThrow(/no <h2>/);
  });
});
