/**
 * Requirement (dashboard): the dashboard identifies the signed-in person - by
 * display name and initials in the header, the email in the account menu.
 * See design D8 of add-dev-accounts-and-employee-names.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountControl } from './AccountControl';
import { AuthContext } from '../features/auth/AuthProvider';
import { renderWithLanguage } from '../test/render';
import { en } from '../i18n/en';
import { pl } from '../i18n/pl';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const account = (name: string, label: string = en.auth.accountLabel) =>
  screen.getByRole('button', { name: label.replace('{{name}}', name) });

describe('the account control', () => {
  it('The identity is displayed', async () => {
    await renderWithLanguage(<AccountControl />, 'en', {
      auth: { email: 'jan.kowalski@example.com', displayName: 'Jan Kowalski', initials: 'JK' },
    });

    const trigger = account('Jan Kowalski');
    expect(trigger).toHaveTextContent('JK');
    expect(trigger).toHaveTextContent('Jan Kowalski');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('jan.kowalski@example.com')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en.auth.signOut })).not.toBeInTheDocument();

    await userEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('jan.kowalski@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.auth.signOut })).toBeInTheDocument();
  });

  it('Stored names give the initials', async () => {
    await renderWithLanguage(<AccountControl />, 'en', {
      auth: { email: 'grzegorz.galka@pse.pl', displayName: 'Grzegorz Gałka', initials: 'GG' },
    });

    expect(account('Grzegorz Gałka')).toHaveTextContent('GGGrzegorz Gałka');
  });

  it('signs out from its menu', async () => {
    const signOut = vi.fn(async () => {});
    await renderWithLanguage(
      <AuthContext.Provider
        value={{
          status: 'signedIn',
          email: 'jan.kowalski@example.com',
          signIn: async () => {},
          signOut,
        }}
      >
        <AccountControl />
      </AuthContext.Provider>,
      'en',
      { auth: { email: 'jan.kowalski@example.com' } },
    );

    await userEvent.click(account('Jan Kowalski'));
    await userEvent.click(screen.getByRole('button', { name: en.auth.signOut }));

    expect(signOut).toHaveBeenCalledOnce();
  });

  it('folds the menu away on Escape, back on its trigger', async () => {
    await renderWithLanguage(<AccountControl />, 'en', {
      auth: { email: 'jan.kowalski@example.com' },
    });
    const trigger = account('Jan Kowalski');
    await userEvent.click(trigger);

    await userEvent.keyboard('{Escape}');

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    expect(screen.queryByText('jan.kowalski@example.com')).not.toBeInTheDocument();
  });

  it('names the account in Polish', async () => {
    await renderWithLanguage(<AccountControl />, 'pl', {
      auth: { email: 'jan.kowalski@example.com' },
    });

    await userEvent.click(account('Jan Kowalski', pl.auth.accountLabel));

    expect(screen.getByRole('button', { name: pl.auth.signOut })).toBeInTheDocument();
  });

  it('offers the sign-in and no identity when nobody is signed in', async () => {
    await renderWithLanguage(<AccountControl />, 'en', { auth: { email: null } });

    expect(screen.getByRole('button', { name: en.auth.signIn })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Account/ })).not.toBeInTheDocument();
  });
});
