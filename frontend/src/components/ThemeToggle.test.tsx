/** The theme control: what it says, what it does, and what it leaves alone. */
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLanguage } from '../test/render';
import { changeLanguage } from '../i18n';
import { en } from '../i18n/en';
import { pl } from '../i18n/pl';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from '../theme/themes';
import { ThemeToggle } from './ThemeToggle';

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
});

const themeOf = () => document.documentElement.getAttribute(THEME_ATTRIBUTE);

describe('ThemeToggle', () => {
  it('starts in the dark theme and offers the light one', async () => {
    await renderWithLanguage(<ThemeToggle />, 'en');

    expect(themeOf()).toBe('dark');
    expect(screen.getByRole('button', { name: en.theme.switchToLight })).toBeInTheDocument();
    expect(screen.getByText(en.theme.light)).toBeInTheDocument();
  });

  it('reports the active theme to assistive technology', async () => {
    await renderWithLanguage(<ThemeToggle />, 'en');

    expect(screen.getByText(en.theme.currentDark)).toBeInTheDocument();
  });

  it('switches to the light theme', async () => {
    await renderWithLanguage(<ThemeToggle />, 'en');

    await userEvent.click(screen.getByRole('button', { name: en.theme.switchToLight }));

    expect(themeOf()).toBe('light');
    expect(screen.getByRole('button', { name: en.theme.switchToDark })).toBeInTheDocument();
    expect(screen.getByText(en.theme.currentLight)).toBeInTheDocument();
  });

  it('switches back to the dark theme', async () => {
    await renderWithLanguage(<ThemeToggle />, 'en');

    await userEvent.click(screen.getByRole('button', { name: en.theme.switchToLight }));
    await userEvent.click(screen.getByRole('button', { name: en.theme.switchToDark }));

    expect(themeOf()).toBe('dark');
  });

  it('remembers an explicit choice', async () => {
    await renderWithLanguage(<ThemeToggle />, 'en');

    await userEvent.click(screen.getByRole('button', { name: en.theme.switchToLight }));

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('is named in the active language', async () => {
    await renderWithLanguage(<ThemeToggle />, 'pl');

    expect(screen.getByRole('button', { name: pl.theme.switchToLight })).toBeInTheDocument();
  });

  it('follows a language change', async () => {
    await renderWithLanguage(<ThemeToggle />, 'en');

    await changeLanguage('pl');

    expect(await screen.findByRole('button', { name: pl.theme.switchToLight })).toBeInTheDocument();
  });

  it('leaves typed text alone when the theme changes', async () => {
    function Form() {
      const [note, setNote] = useState('');
      return (
        <>
          <ThemeToggle />
          <label htmlFor="note">Note</label>
          <input id="note" value={note} onChange={(event) => setNote(event.target.value)} />
        </>
      );
    }
    await renderWithLanguage(<Form />, 'en');
    const field = screen.getByLabelText('Note');
    await userEvent.type(field, 'half a thought');

    await userEvent.click(screen.getByRole('button', { name: en.theme.switchToLight }));

    expect(themeOf()).toBe('light');
    expect(field).toHaveValue('half a thought');
  });
});
