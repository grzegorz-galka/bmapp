/**
 * Scenarios for "Errors reported by the API are displayed in the active
 * language" that do not need a rendered page, from specs/localization/spec.md.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import i18n from './index';
import { translateErrorCode } from './apiErrors';
import { en } from './en';
import { pl } from './pl';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('translateErrorCode', () => {
  it('returns the catalogue message for a known code, in each language', async () => {
    const failure = {
      field: 'name',
      code: 'team_name.duplicate',
      message: "A team named 'Platform' already exists.",
    };

    await i18n.changeLanguage('en');
    expect(translateErrorCode(i18n.t, failure)).toBe(en.errors['team_name.duplicate']);

    await i18n.changeLanguage('pl');
    expect(translateErrorCode(i18n.t, failure)).toBe(pl.errors['team_name.duplicate']);
  });

  it('falls back to the generic message for an unknown code', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await i18n.changeLanguage('pl');

    const message = translateErrorCode(i18n.t, {
      field: 'name',
      code: 'team_name.cursed',
      message: 'Something the backend knows about and we do not.',
    });

    expect(message).toBe(pl.errors.generic);
    // The API's English text is never what the user sees...
    expect(message).not.toContain('Something the backend knows');
    // ...but a developer still needs to know the code arrived.
    expect(warn).toHaveBeenCalledOnce();
  });

  it('falls back to the generic message when there is no code at all', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await i18n.changeLanguage('en');

    expect(translateErrorCode(i18n.t, { field: 'name', message: 'Unhelpful.' })).toBe(
      en.errors.generic,
    );
  });
});
