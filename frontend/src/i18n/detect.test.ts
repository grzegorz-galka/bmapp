/**
 * One test per scenario of "The initial language follows the browser" and
 * "The chosen language is remembered" in specs/localization/spec.md.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { readStoredLanguage, resolveLanguage, storeLanguage } from './detect';
import { LANGUAGE_STORAGE_KEY } from './languages';

function withBrowserLanguages(languages: readonly string[] | undefined) {
  vi.stubGlobal('navigator', { languages });
}

function withStorage(store: Storage) {
  vi.stubGlobal('localStorage', store);
}

/** A store whose every access throws, as in a private window. */
function unreadableStorage(): Storage {
  const refuse = () => {
    throw new Error('access denied');
  };
  return {
    get length(): number {
      return refuse();
    },
    clear: refuse,
    getItem: refuse,
    key: refuse,
    removeItem: refuse,
    setItem: refuse,
  } as unknown as Storage;
}

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => map.delete(key),
    setItem: (key: string, value: string) => map.set(key, value),
  } as unknown as Storage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the initial language follows the browser', () => {
  it('chooses Polish when the browser prefers Polish in any regional variant', () => {
    withStorage(memoryStorage());
    withBrowserLanguages(['pl-PL', 'en-GB']);

    expect(resolveLanguage()).toBe('pl');
  });

  it('chooses English when the browser prefers only unsupported languages', () => {
    withStorage(memoryStorage());
    withBrowserLanguages(['de-DE', 'fr']);

    expect(resolveLanguage()).toBe('en');
  });

  it('chooses English when the browser reports no preference', () => {
    withStorage(memoryStorage());
    withBrowserLanguages(undefined);

    expect(resolveLanguage()).toBe('en');
  });

  it('takes the first supported preference, not merely the first Polish one', () => {
    withStorage(memoryStorage());
    withBrowserLanguages(['de', 'en-US', 'pl']);

    expect(resolveLanguage()).toBe('en');
  });
});

describe('the chosen language is remembered', () => {
  it('applies a remembered choice on a later visit', () => {
    withStorage(memoryStorage({ [LANGUAGE_STORAGE_KEY]: 'pl' }));
    withBrowserLanguages(['en-GB']);

    expect(resolveLanguage()).toBe('pl');
  });

  it('lets a remembered choice override the browser preference', () => {
    withStorage(memoryStorage({ [LANGUAGE_STORAGE_KEY]: 'en' }));
    withBrowserLanguages(['pl-PL']);

    expect(resolveLanguage()).toBe('en');
  });

  it('ignores a remembered value naming an unsupported language', () => {
    withStorage(memoryStorage({ [LANGUAGE_STORAGE_KEY]: 'de' }));
    withBrowserLanguages(['pl-PL']);

    expect(resolveLanguage()).toBe('pl');
  });

  it('starts normally when the remembered value cannot be read back', () => {
    withStorage(unreadableStorage());
    withBrowserLanguages(['pl-PL']);

    expect(readStoredLanguage()).toBeUndefined();
    expect(resolveLanguage()).toBe('pl');
  });

  it('remembers an explicit choice', () => {
    const storage = memoryStorage();
    withStorage(storage);
    withBrowserLanguages(['en-GB']);

    storeLanguage('pl');

    expect(storage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pl');
    expect(resolveLanguage()).toBe('pl');
  });

  it('does not fail when the store refuses the write', () => {
    withStorage(unreadableStorage());
    withBrowserLanguages(['en-GB']);

    expect(() => storeLanguage('pl')).not.toThrow();
  });
});
