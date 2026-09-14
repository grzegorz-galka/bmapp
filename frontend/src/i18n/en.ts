/**
 * The English catalogue, and the source of truth for what keys exist.
 *
 * `pl.ts` declares its export as `Translations`, so a key added here and not
 * there is a compile error rather than a string that silently falls back to
 * English in a Polish interface.
 */
export const en = {
  app: {
    title: 'BMAPP',
  },
  language: {
    label: 'Language',
    // Each language is named in its own language: someone looking for Polish
    // is not helped by the word "Polish" written in a language they don't read.
    en: 'English',
    pl: 'Polski',
  },
  teams: {
    heading: 'Teams',
    nameLabel: 'Team name',
    register: 'Register team',
    registering: 'Registering…',
    loading: 'Loading teams…',
    loadFailed: 'Could not load teams.',
    empty: 'No teams registered yet.',
    boardSuffix: 'board: {{name}}',
  },
  errors: {
    // Keyed by the code the API reports. `generic` covers a code this
    // catalogue does not know, so no untranslated text ever reaches a user.
    generic: 'Something went wrong. Please try again.',
    'team_name.blank': 'Enter a team name.',
    'team_name.too_long': 'A team name can be at most 200 characters.',
    'team_name.duplicate': 'A team with this name already exists.',
    'request.invalid_field': 'That value is not valid.',
  },
} as const;

/** The shape every catalogue must have. */
export type Translations = {
  -readonly [Section in keyof typeof en]: {
    -readonly [Key in keyof (typeof en)[Section]]: string;
  };
};
