/** The languages the interface is available in. English is the fallback. */
export const SUPPORTED_LANGUAGES = ['en', 'pl'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const FALLBACK_LANGUAGE: Language = 'en';

/** Where an explicit choice is remembered between visits. */
export const LANGUAGE_STORAGE_KEY = 'bmapp.language';

export function isSupported(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}
