/** Resolving the theme, and surviving a storage that will not cooperate. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readStoredTheme, resolveTheme, storeTheme } from './detect';
import { THEME_STORAGE_KEY } from './themes';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

/** Replace localStorage with one that throws on every access. */
function breakStorage(): void {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('site data is blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('site data is blocked');
  });
}

describe('readStoredTheme', () => {
  it('returns a remembered supported theme', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');

    expect(readStoredTheme()).toBe('light');
  });

  it('ignores a remembered theme that is not supported', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'solarized');

    expect(readStoredTheme()).toBeUndefined();
  });

  it('reports no choice when nothing is remembered', () => {
    expect(readStoredTheme()).toBeUndefined();
  });

  it('reports no choice when the store cannot be read', () => {
    breakStorage();

    expect(readStoredTheme()).toBeUndefined();
  });
});

describe('storeTheme', () => {
  it('remembers an explicit choice', () => {
    storeTheme('light');

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('does not throw when the store refuses the write', () => {
    breakStorage();

    expect(() => storeTheme('light')).not.toThrow();
  });
});

describe('resolveTheme', () => {
  it('starts a first-time visitor in the dark theme', () => {
    expect(resolveTheme()).toBe('dark');
  });

  it('applies a remembered choice on a later visit', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');

    expect(resolveTheme()).toBe('light');
  });

  it('falls back to the dark theme when the remembered value is unusable', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'solarized');

    expect(resolveTheme()).toBe('dark');
  });

  it('starts normally when the store cannot be read', () => {
    breakStorage();

    expect(resolveTheme()).toBe('dark');
  });
});
