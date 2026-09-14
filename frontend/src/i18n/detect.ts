/**
 * Deciding which language to start in, and remembering an explicit choice.
 *
 * Written here rather than delegated to a detector plugin because the awkward
 * cases are the ones that matter: storage that throws on access, and a stored
 * value naming a language we no longer support. Both must leave the
 * application starting normally.
 */
import { FALLBACK_LANGUAGE, LANGUAGE_STORAGE_KEY, isSupported, type Language } from './languages';

/**
 * Read the remembered choice.
 *
 * Accessing localStorage throws outright in a private window or with site data
 * blocked, so every read is guarded: an unreadable store is simply no stored
 * choice.
 */
export function readStoredLanguage(): Language | undefined {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupported(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

/** Remember an explicit choice. A store that refuses the write is not fatal. */
export function storeLanguage(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The user keeps the language for this visit; it just will not be
    // remembered for the next one.
  }
}

/**
 * The first supported language the browser asks for, matched on the primary
 * subtag so that `pl-PL` and `pl` mean the same thing.
 */
function browserLanguage(): Language | undefined {
  const preferences = typeof navigator === 'undefined' ? undefined : navigator.languages;
  if (!preferences) {
    return undefined;
  }
  for (const preference of preferences) {
    const primary = preference.split('-')[0]?.toLowerCase();
    if (isSupported(primary)) {
      return primary;
    }
  }
  return undefined;
}

/**
 * The language to start in: an explicit choice first, then what the browser
 * asks for, then English.
 */
export function resolveLanguage(): Language {
  return readStoredLanguage() ?? browserLanguage() ?? FALLBACK_LANGUAGE;
}
