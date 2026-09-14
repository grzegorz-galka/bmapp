/**
 * Scenario: A language is missing a translation, from
 * specs/localization/spec.md.
 *
 * The compiler already rejects a missing key, because `pl` is annotated as
 * `Translations`. This is the backstop for someone loosening that annotation,
 * and it names every key that is missing rather than only the first.
 */
import { describe, expect, it } from 'vitest';
import { en } from './en';
import { pl } from './pl';
import { SUPPORTED_LANGUAGES } from './languages';

type Catalogue = Record<string, Record<string, string>>;

function flatKeys(catalogue: Catalogue): string[] {
  return Object.entries(catalogue)
    .flatMap(([section, entries]) => Object.keys(entries).map((key) => `${section}.${key}`))
    .sort();
}

function missingFrom(from: string[], against: string[]): string[] {
  return against.filter((key) => !from.includes(key));
}

describe('the catalogues', () => {
  it('define exactly the same keys in both languages', () => {
    const english = flatKeys(en as unknown as Catalogue);
    const polish = flatKeys(pl as unknown as Catalogue);

    expect({
      missingFromPolish: missingFrom(polish, english),
      missingFromEnglish: missingFrom(english, polish),
    }).toEqual({ missingFromPolish: [], missingFromEnglish: [] });
  });

  it('name every supported language in the language section', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      expect(en.language[language]).toBeTruthy();
      expect(pl.language[language]).toBeTruthy();
    }
  });

  it('leave no entry empty', () => {
    for (const [name, catalogue] of [
      ['en', en],
      ['pl', pl],
    ] as const) {
      for (const [key, value] of Object.entries(flatValues(catalogue as unknown as Catalogue))) {
        expect(value, `${name}.${key} is empty`).not.toBe('');
      }
    }
  });

  /**
   * Polish is actually Polish.
   *
   * Without this the suite would still pass if `pl` were pointed at `en`:
   * every other test compares a render against the catalogue it came from.
   */
  it('translate the interface rather than repeating the English text', () => {
    expect(pl.teams.heading).toBe('Zespoły');
    expect(pl.teams.register).toBe('Zarejestruj zespół');
    expect(pl.teams.empty).toBe('Nie zarejestrowano jeszcze żadnego zespołu.');
    expect(pl.errors['team_name.duplicate']).toBe('Zespół o tej nazwie już istnieje.');

    expect(en.teams.heading).toBe('Teams');
    expect(en.teams.register).toBe('Register team');
    expect(en.errors['team_name.duplicate']).toBe('A team with this name already exists.');
  });
});

function flatValues(catalogue: Catalogue): Record<string, string> {
  return Object.fromEntries(
    Object.entries(catalogue).flatMap(([section, entries]) =>
      Object.entries(entries).map(([key, value]) => [`${section}.${key}`, value]),
    ),
  );
}
