/**
 * i18next setup.
 *
 * Both catalogues are bundled and initialised synchronously: they are small,
 * and a language change that needs no loading state is what keeps a form's
 * half-typed contents intact when the user switches.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { pl } from './pl';
import { resolveLanguage, storeLanguage } from './detect';
import { FALLBACK_LANGUAGE, type Language } from './languages';

export const NAMESPACE = 'translation';

void i18n.use(initReactI18next).init({
  resources: {
    en: { [NAMESPACE]: en },
    pl: { [NAMESPACE]: pl },
  },
  lng: resolveLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  // A missing key must be loud, not quietly answered in the other language.
  // The compiler already rejects one; this covers a catalogue loaded at runtime.
  fallbackNS: false,
  interpolation: { escapeValue: false },
});

/** Keep the document's language in step, starting with the initial value. */
function applyDocumentLanguage(language: string): void {
  document.documentElement.lang = language;
}

i18n.on('languageChanged', applyDocumentLanguage);
applyDocumentLanguage(i18n.language);

/** Change the language and remember it as an explicit choice. */
export async function changeLanguage(language: Language): Promise<void> {
  storeLanguage(language);
  await i18n.changeLanguage(language);
}

export default i18n;
