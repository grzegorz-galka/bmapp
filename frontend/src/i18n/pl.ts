/**
 * The Polish catalogue.
 *
 * Annotated as `Translations` on purpose: that is what makes a missing or a
 * stray key a `tsc` failure. Domain vocabulary follows the glossary in this
 * change's design.md - Tablica, Spotkanie, Zespół, Wskaźnik, Zadanie.
 */
import type { Translations } from './en';

export const pl: Translations = {
  app: {
    title: 'BMAPP',
  },
  language: {
    label: 'Język',
    en: 'English',
    pl: 'Polski',
  },
  teams: {
    heading: 'Zespoły',
    nameLabel: 'Nazwa zespołu',
    register: 'Zarejestruj zespół',
    registering: 'Rejestrowanie…',
    loading: 'Wczytywanie zespołów…',
    loadFailed: 'Nie udało się wczytać zespołów.',
    empty: 'Nie zarejestrowano jeszcze żadnego zespołu.',
    boardSuffix: 'tablica: {{name}}',
  },
  errors: {
    generic: 'Coś poszło nie tak. Spróbuj ponownie.',
    'team_name.blank': 'Podaj nazwę zespołu.',
    'team_name.too_long': 'Nazwa zespołu może mieć najwyżej 200 znaków.',
    'team_name.duplicate': 'Zespół o tej nazwie już istnieje.',
    'request.invalid_field': 'Ta wartość jest nieprawidłowa.',
  },
};
