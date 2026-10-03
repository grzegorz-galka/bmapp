/**
 * Requirement: a returning response that does not match the request is refused.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import { AuthCallbackPage } from './AuthCallbackPage';

async function renderCallback(complete: () => Promise<boolean>, language: 'en' | 'pl' = 'en') {
  await renderWithLanguage(
    <Routes>
      <Route path="/auth/callback" element={<AuthCallbackPage complete={complete} />} />
      <Route path="/" element={<h1>the hub</h1>} />
    </Routes>,
    language,
    { route: '/auth/callback', auth: { email: null } },
  );
}

it('returns the person to the application once the sign-in completes', async () => {
  await renderCallback(async () => true);

  expect(await screen.findByRole('heading', { name: 'the hub' })).toBeInTheDocument();
});

describe('a response that does not match the sign-in this page started', () => {
  it('signs nobody in and says so', async () => {
    await renderCallback(async () => {
      throw new Error('state mismatch');
    });

    expect(
      await screen.findByRole('heading', { name: en.auth.signInFailedTitle }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'the hub' })).not.toBeInTheDocument();
  });

  it('reports the failure in the active language', async () => {
    await renderCallback(async () => {
      throw new Error('state mismatch');
    }, 'pl');

    expect(
      await screen.findByRole('heading', { name: pl.auth.signInFailedTitle }),
    ).toBeInTheDocument();
    expect(screen.queryByText(en.auth.signInFailed)).not.toBeInTheDocument();
  });

  it('treats a response carrying no token as a failure', async () => {
    await renderCallback(async () => false);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: en.auth.signInFailedTitle })).toBeInTheDocument(),
    );
  });
});

it('does not complete a sign-in more than once', async () => {
  const complete = vi.fn(async () => true);
  await renderCallback(complete);

  await screen.findByRole('heading', { name: 'the hub' });
  expect(complete).toHaveBeenCalledTimes(1);
});
