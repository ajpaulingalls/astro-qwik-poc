import * as chromeLauncher from 'chrome-launcher';

const CHROME_FLAGS = ['--headless=new', '--no-sandbox'];

export async function withChrome<T>(fn: (port: number) => Promise<T>): Promise<T> {
  const chrome = await chromeLauncher.launch({ chromeFlags: CHROME_FLAGS });
  try {
    return await fn(chrome.port);
  } finally {
    await chrome.kill();
  }
}
