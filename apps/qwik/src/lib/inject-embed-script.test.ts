// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { injectEmbedScript } from './inject-embed-script';

const TEST_SRC = 'https://example.com/embed-test.js';
const SCRIPT_SELECTOR = `script[src="${TEST_SRC}"]`;

describe('injectEmbedScript', () => {
  afterEach(() => {
    document.querySelectorAll('script').forEach((s) => s.remove());
  });

  it('appends a script tag with the given src', () => {
    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();
    injectEmbedScript(TEST_SRC);
    const script = document.querySelector(SCRIPT_SELECTOR);
    expect(script).toBeTruthy();
    expect(script?.getAttribute('async')).not.toBeNull();
  });

  it('does not duplicate the script across multiple calls (idempotent)', () => {
    injectEmbedScript(TEST_SRC);
    injectEmbedScript(TEST_SRC);
    expect(document.querySelectorAll(SCRIPT_SELECTOR).length).toBe(1);
  });

  it('skips when src is null or empty', () => {
    injectEmbedScript(null);
    injectEmbedScript('');
    injectEmbedScript(undefined);
    expect(document.querySelectorAll('script').length).toBe(0);
  });

  it('invokes onload when the script tag fires its load event', () => {
    const onload = vi.fn();
    injectEmbedScript(TEST_SRC, { onload });
    const script = document.querySelector(SCRIPT_SELECTOR) as HTMLScriptElement;
    script.dispatchEvent(new Event('load'));
    expect(onload).toHaveBeenCalledTimes(1);
  });

  it('invokes onload immediately when the script has already loaded', () => {
    injectEmbedScript(TEST_SRC);
    const script = document.querySelector(SCRIPT_SELECTOR) as HTMLScriptElement;
    script.dispatchEvent(new Event('load'));
    const onload = vi.fn();
    injectEmbedScript(TEST_SRC, { onload });
    expect(onload).toHaveBeenCalledTimes(1);
  });

  it('defers onload when the script is in the DOM but has not loaded yet', () => {
    injectEmbedScript(TEST_SRC);
    const onload = vi.fn();
    injectEmbedScript(TEST_SRC, { onload });
    expect(onload).not.toHaveBeenCalled();
    const script = document.querySelector(SCRIPT_SELECTOR) as HTMLScriptElement;
    script.dispatchEvent(new Event('load'));
    expect(onload).toHaveBeenCalledTimes(1);
  });
});
