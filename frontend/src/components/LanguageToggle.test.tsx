/**
 * Scenarios for "A user can change the language" and "The document reports the
 * active language" in specs/localization/spec.md.
 */
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageToggle } from './LanguageToggle';
import { renderWithLanguage } from '../test/render';
import { en } from '../i18n/en';
import { pl } from '../i18n/pl';
import { LANGUAGE_STORAGE_KEY } from '../i18n/languages';

afterEach(() => {
  window.localStorage.clear();
});

const flagShown = (button: HTMLElement) =>
  button.querySelector('svg[data-flag]')?.getAttribute('data-flag');

describe('LanguageToggle', () => {
  it('offers Polish while the interface is in English', async () => {
    await renderWithLanguage(<LanguageToggle />, 'en');

    const toggle = screen.getByRole('button', { name: en.language.switchToPl });
    expect(flagShown(toggle)).toBe('pl');
    expect(screen.getByText(en.language.pl)).toHaveAttribute('lang', 'pl');
    expect(screen.getByText(en.language.currentEn)).toBeInTheDocument();
    expect(toggle).toHaveAttribute('title', en.language.currentEn);
  });

  it('offers English while the interface is in Polish', async () => {
    await renderWithLanguage(<LanguageToggle />, 'pl');

    const toggle = screen.getByRole('button', { name: pl.language.switchToEn });
    expect(flagShown(toggle)).toBe('en');
    expect(screen.getByText(pl.language.en)).toHaveAttribute('lang', 'en');
    expect(screen.getByText(pl.language.currentPl)).toBeInTheDocument();
    expect(toggle).toHaveAttribute('title', pl.language.currentPl);
  });

  it('switches to Polish, and the document language follows', async () => {
    await renderWithLanguage(<LanguageToggle />, 'en');

    await userEvent.click(screen.getByRole('button', { name: en.language.switchToPl }));

    const toggle = await screen.findByRole('button', { name: pl.language.switchToEn });
    expect(flagShown(toggle)).toBe('en');
    expect(document.documentElement.lang).toBe('pl');
  });

  it('switches back to English, and the document language follows', async () => {
    await renderWithLanguage(<LanguageToggle />, 'pl');

    await userEvent.click(screen.getByRole('button', { name: pl.language.switchToEn }));

    const toggle = await screen.findByRole('button', { name: en.language.switchToPl });
    expect(flagShown(toggle)).toBe('pl');
    expect(document.documentElement.lang).toBe('en');
  });

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('works from the keyboard with %s', async (_, key) => {
    await renderWithLanguage(<LanguageToggle />, 'en');

    screen.getByRole('button', { name: en.language.switchToPl }).focus();
    await userEvent.keyboard(key);

    expect(await screen.findByRole('button', { name: pl.language.switchToEn })).toBeInTheDocument();
  });

  it('does not rely on the flag alone', async () => {
    await renderWithLanguage(<LanguageToggle />, 'en');

    const toggle = screen.getByRole('button', { name: en.language.switchToPl });
    // The flag is never announced...
    expect(toggle.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    // ...and the name and the visible caption carry the language without it.
    expect(toggle).toHaveTextContent(en.language.pl);
  });

  it('keeps typed text across a language change', async () => {
    function WithField() {
      const [value, setValue] = useState('');
      return (
        <>
          <input aria-label="draft" value={value} onChange={(e) => setValue(e.target.value)} />
          <LanguageToggle />
        </>
      );
    }
    await renderWithLanguage(<WithField />, 'en');

    await userEvent.type(screen.getByLabelText('draft'), 'Half typed');
    await userEvent.click(screen.getByRole('button', { name: en.language.switchToPl }));

    await screen.findByRole('button', { name: pl.language.switchToEn });
    expect(screen.getByLabelText('draft')).toHaveValue('Half typed');
  });

  it('remembers the choice the user made', async () => {
    await renderWithLanguage(<LanguageToggle />, 'en');

    await userEvent.click(screen.getByRole('button', { name: en.language.switchToPl }));

    await screen.findByRole('button', { name: pl.language.switchToEn });
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pl');
  });
});
