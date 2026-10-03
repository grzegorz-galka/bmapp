import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n';
import {
  FALLBACK_LANGUAGE,
  SUPPORTED_LANGUAGES,
  isSupported,
  type Language,
} from '../i18n/languages';
import { PolishFlag, UnionFlag } from './flags';
import shared from './HeaderToggle.module.css';
import styles from './LanguageToggle.module.css';

const FLAG = { en: UnionFlag, pl: PolishFlag } as const;
const SWITCH_TO = { en: 'language.switchToEn', pl: 'language.switchToPl' } as const;
const CURRENT = { en: 'language.currentEn', pl: 'language.currentPl' } as const;

/**
 * The language control, a twin of the theme toggle.
 *
 * Captioned with the language it would switch to - its flag and its own name -
 * because that is how the theme toggle reads. The caption alone is ambiguous
 * ("Polski": is the page Polish, or will it be?), so the accessible name says
 * which way it goes and the description says where you are now.
 *
 * A toggle has two states, and so does the language list; `languages.test.ts`
 * holds that, so a third language cannot arrive without a different control.
 */
export function LanguageToggle() {
  const { t, i18n } = useTranslation();
  const active: Language = isSupported(i18n.language) ? i18n.language : FALLBACK_LANGUAGE;
  const next = SUPPORTED_LANGUAGES.find((language) => language !== active) ?? active;
  const Flag = FLAG[next];

  return (
    <button
      type="button"
      className={shared.toggle}
      onClick={() => void changeLanguage(next)}
      aria-label={t(SWITCH_TO[next])}
      title={t(CURRENT[active])}
    >
      <Flag className={styles.flag} data-flag={next} />
      {/* Marked with its own language, so a reader that does voice the caption
          says "Polski" as Polish rather than as an English word. */}
      <span lang={next}>{t(`language.${next}`)}</span>
      <span className="visually-hidden">{t(CURRENT[active])}</span>
    </button>
  );
}
