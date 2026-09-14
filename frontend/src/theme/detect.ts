/**
 * Deciding which theme to start in, and remembering an explicit choice.
 *
 * Mirrors src/i18n/detect.ts, and for the same reason: the awkward cases are
 * the ones that matter. localStorage throws outright in a private window or
 * with site data blocked, and a stored value can name a theme that no longer
 * exists. Neither may stop the application starting.
 */
import { DEFAULT_THEME, THEME_STORAGE_KEY, isSupportedTheme, type Theme } from './themes';

/** Read the remembered choice. An unreadable store is simply no choice. */
export function readStoredTheme(): Theme | undefined {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isSupportedTheme(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

/** Remember an explicit choice. A store that refuses the write is not fatal. */
export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The user keeps the theme for this visit; it just will not be remembered
    // for the next one.
  }
}

/** The theme to start in: an explicit choice, otherwise the default. */
export function resolveTheme(): Theme {
  return readStoredTheme() ?? DEFAULT_THEME;
}
