import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n';
import { SUPPORTED_LANGUAGES, isSupported } from '../i18n/languages';

/**
 * The language control. A labelled <select> rather than a custom widget: two
 * options, and the native element is keyboard accessible without any work.
 */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <label>
      {t('language.label')}{' '}
      <select
        value={i18n.language}
        onChange={(event) => {
          const chosen = event.target.value;
          if (isSupported(chosen)) {
            void changeLanguage(chosen);
          }
        }}
      >
        {SUPPORTED_LANGUAGES.map((language) => (
          <option key={language} value={language}>
            {t(`language.${language}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
