/**
 * Scenarios for "A user can change the language" and "The document reports the
 * active language" in specs/localization/spec.md.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageSwitcher } from './LanguageSwitcher';
import { renderWithLanguage } from '../test/render';
import { en } from '../i18n/en';
import { pl } from '../i18n/pl';
import { LANGUAGE_STORAGE_KEY } from '../i18n/languages';

afterEach(() => {
  window.localStorage.clear();
});

describe('LanguageSwitcher', () => {
  it('names both languages, each in its own language, and marks the active one', async () => {
    await renderWithLanguage(<LanguageSwitcher />, 'en');

    const control = screen.getByLabelText(en.language.label);
    expect(control).toHaveValue('en');
    expect(screen.getByRole('option', { name: en.language.en })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: en.language.pl })).toBeInTheDocument();
  });

  it('translates its own label', async () => {
    await renderWithLanguage(<LanguageSwitcher />, 'pl');

    expect(screen.getByLabelText(pl.language.label)).toHaveValue('pl');
  });

  it('switches to Polish, and the document language follows', async () => {
    await renderWithLanguage(<LanguageSwitcher />, 'en');

    await userEvent.selectOptions(screen.getByLabelText(en.language.label), 'pl');

    expect(await screen.findByLabelText(pl.language.label)).toHaveValue('pl');
    expect(document.documentElement.lang).toBe('pl');
  });

  it('switches back to English, and the document language follows', async () => {
    await renderWithLanguage(<LanguageSwitcher />, 'pl');

    await userEvent.selectOptions(screen.getByLabelText(pl.language.label), 'en');

    expect(await screen.findByLabelText(en.language.label)).toHaveValue('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('remembers the choice the user made', async () => {
    await renderWithLanguage(<LanguageSwitcher />, 'en');

    await userEvent.selectOptions(screen.getByLabelText(en.language.label), 'pl');

    await screen.findByLabelText(pl.language.label);
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pl');
  });
});
