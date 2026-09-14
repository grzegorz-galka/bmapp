/**
 * The active theme, and the one control that changes it.
 *
 * The provider owns the `data-theme` attribute on the document element, which
 * is what the palettes in theme.css select on. index.html sets the same
 * attribute before the bundle loads so a remembered light theme does not flash
 * dark first; this simply takes over from there.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { resolveTheme, storeTheme } from './detect';
import { THEME_ATTRIBUTE, otherTheme, type Theme } from './themes';

interface ThemeContextValue {
  theme: Theme;
  /** The theme using the control would switch to. */
  next: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(resolveTheme);

  useEffect(() => {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const chosen = otherTheme(current);
      storeTheme(chosen);
      return chosen;
    });
  }, []);

  const value = useMemo(() => ({ theme, next: otherTheme(theme), toggle }), [theme, toggle]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used inside a ThemeProvider');
  }
  return value;
}
