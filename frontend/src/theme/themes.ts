/**
 * The themes the interface is available in. Dark is the default.
 *
 * Dark rather than the machine's preference because the common case is a team
 * reading the board on a meeting-room screen, not a desk. Honouring
 * `prefers-color-scheme` instead would be a change to `resolveTheme` alone.
 */
export const SUPPORTED_THEMES = ['dark', 'light'] as const;

export type Theme = (typeof SUPPORTED_THEMES)[number];

export const DEFAULT_THEME: Theme = 'dark';

/** Where an explicit choice is remembered between visits. */
export const THEME_STORAGE_KEY = 'bmapp.theme';

/** The attribute the palettes in theme.css are selected by. */
export const THEME_ATTRIBUTE = 'data-theme';

export function isSupportedTheme(value: unknown): value is Theme {
  return SUPPORTED_THEMES.includes(value as Theme);
}

/** The theme the toggle would switch to from here. */
export function otherTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}
