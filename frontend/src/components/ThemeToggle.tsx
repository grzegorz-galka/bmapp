import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';
import styles from './ThemeToggle.module.css';

const SWITCH_TO = { dark: 'theme.switchToDark', light: 'theme.switchToLight' } as const;
const CURRENT = { dark: 'theme.currentDark', light: 'theme.currentLight' } as const;

/**
 * The theme control.
 *
 * Captioned with the theme it would switch to, as the mockup has it. That
 * caption alone is ambiguous read out of context - "Light" could as easily be
 * the theme you are in - so the accessible name says which way it goes and the
 * description says where you are now.
 */
export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, next, toggle } = useTheme();

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggle}
      aria-label={t(SWITCH_TO[next])}
      title={t(CURRENT[theme])}
    >
      <span className={styles.dial} aria-hidden="true" />
      <span>{t(`theme.${next}`)}</span>
      <span className="visually-hidden">{t(CURRENT[theme])}</span>
    </button>
  );
}
