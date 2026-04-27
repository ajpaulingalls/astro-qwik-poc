// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { useEmbedScript } from './use-embed-script';

const TEST_SRC = 'https://example.com/embed-test.js';
const SCRIPT_SELECTOR = `script[src="${TEST_SRC}"]`;

function Probe({ src, onload }: { src: string; onload?: () => void }) {
  useEmbedScript(src, { onload });
  return null;
}

describe('useEmbedScript', () => {
  afterEach(() => {
    cleanup();
    document.querySelectorAll(SCRIPT_SELECTOR).forEach((s) => s.remove());
  });

  it('appends a script tag with the given src on mount', () => {
    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();
    render(<Probe src={TEST_SRC} />);
    const script = document.querySelector(SCRIPT_SELECTOR);
    expect(script).toBeTruthy();
    expect(script?.getAttribute('async')).not.toBeNull();
  });

  it('does not duplicate the script across multiple mounts (idempotent)', () => {
    render(<Probe src={TEST_SRC} />);
    cleanup();
    render(<Probe src={TEST_SRC} />);
    expect(document.querySelectorAll(SCRIPT_SELECTOR).length).toBe(1);
  });

  it('invokes onload when the script tag fires its load event', () => {
    const onload = vi.fn();
    render(<Probe src={TEST_SRC} onload={onload} />);
    const script = document.querySelector(SCRIPT_SELECTOR) as HTMLScriptElement;
    expect(script).toBeTruthy();
    script.dispatchEvent(new Event('load'));
    expect(onload).toHaveBeenCalledTimes(1);
  });

  it('invokes onload immediately when the script has already loaded', () => {
    render(<Probe src={TEST_SRC} />);
    const script = document.querySelector(SCRIPT_SELECTOR) as HTMLScriptElement;
    script.dispatchEvent(new Event('load'));
    cleanup();
    const onload = vi.fn();
    render(<Probe src={TEST_SRC} onload={onload} />);
    expect(onload).toHaveBeenCalledTimes(1);
  });

  it('defers onload when the script is in the DOM but has not loaded yet', () => {
    render(<Probe src={TEST_SRC} />);
    cleanup();
    const onload = vi.fn();
    render(<Probe src={TEST_SRC} onload={onload} />);
    expect(onload).not.toHaveBeenCalled();
    const script = document.querySelector(SCRIPT_SELECTOR) as HTMLScriptElement;
    script.dispatchEvent(new Event('load'));
    expect(onload).toHaveBeenCalledTimes(1);
  });

  it('appends a new script when src changes', () => {
    const ALT_SRC = 'https://example.com/embed-alt.js';
    const { rerender } = render(<Probe src={TEST_SRC} />);
    rerender(<Probe src={ALT_SRC} />);
    expect(document.querySelector(`script[src="${ALT_SRC}"]`)).toBeTruthy();
    expect(document.querySelector(SCRIPT_SELECTOR)).toBeTruthy();
    document.querySelectorAll(`script[src="${ALT_SRC}"]`).forEach((s) => s.remove());
  });
});
