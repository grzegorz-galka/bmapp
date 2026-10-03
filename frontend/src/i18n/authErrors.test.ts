/**
 * Requirement: a refusal says that it is a refusal, and why - readably.
 *
 * The API's `message` is English for a developer; what a user reads comes
 * from the catalogue of the language they are in.
 */
import { describe, expect, it } from 'vitest';
import i18n from './index';
import { en } from './en';
import { pl } from './pl';
import { translateErrorCode } from './apiErrors';

const AUTH_CODES = [
  'auth.token_missing',
  'auth.token_expired',
  'auth.token_invalid',
  'auth.forbidden',
  'auth.not_an_employee',
] as const;

describe('every auth refusal has wording in both languages', () => {
  it.each(AUTH_CODES)('%s is in both catalogues', (code) => {
    expect(en.errors[code]).toBeTruthy();
    expect(pl.errors[code]).toBeTruthy();
  });

  it.each(AUTH_CODES)('%s reads differently in each language', (code) => {
    expect(pl.errors[code]).not.toBe(en.errors[code]);
  });
});

describe('a refusal is rendered from the active catalogue', () => {
  it.each(AUTH_CODES)('%s in English', async (code) => {
    await i18n.changeLanguage('en');

    const shown = translateErrorCode(i18n.t.bind(i18n), {
      field: null,
      code,
      message: 'developer-facing English text',
    });

    expect(shown).toBe(en.errors[code]);
    expect(shown).not.toContain('developer-facing');
  });

  it.each(AUTH_CODES)('%s in Polish, with the API text nowhere', async (code) => {
    await i18n.changeLanguage('pl');

    const shown = translateErrorCode(i18n.t.bind(i18n), {
      field: null,
      code,
      message: 'developer-facing English text',
    });

    expect(shown).toBe(pl.errors[code]);
    expect(shown).not.toContain('developer-facing');
  });
});
