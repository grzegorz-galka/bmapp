/**
 * The app-level scenarios: the language toggle is on the page whatever it
 * shows, and changing language does not throw away work in progress.
 * See "A user can change the language" in specs/localization/spec.md.
 *
 * Rendered at /teams, which is where the form these scenarios need lives now
 * that the hub is what the application opens at.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoutes } from './routes';
import { renderWithLanguage } from './test/render';
import { en } from './i18n/en';
import { pl } from './i18n/pl';
import type { Team } from './api/teams';

function team(name: string): Team {
  return {
    id: `id-${name}`,
    name,
    board: { id: `board-${name}`, name },
    leader: { id: `leader-${name}`, email: 'lead@example.com' },
    member_count: 1,
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('App', () => {
  it('shows the language toggle above the page', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] } as Response);

    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', {
      route: '/teams',
      auth: { isAdmin: true },
    });

    expect(screen.getByRole('button', { name: en.language.switchToPl })).toBeInTheDocument();
    expect(await screen.findByText(en.teams.empty)).toBeInTheDocument();
  });

  it('retranslates the whole page when the language changes, with no reload', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [team('Platform')],
    } as Response);

    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', {
      route: '/teams',
      auth: { isAdmin: true },
    });
    await screen.findByRole('listitem');

    await userEvent.click(screen.getByRole('button', { name: en.language.switchToPl }));

    expect(await screen.findByRole('heading', { name: pl.teams.heading })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: pl.teams.register })).toBeInTheDocument();
    expect(screen.queryByText(en.teams.heading)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: pl.language.switchToEn }));

    expect(await screen.findByRole('heading', { name: en.teams.heading })).toBeInTheDocument();
    expect(screen.queryByText(pl.teams.heading)).not.toBeInTheDocument();
  });

  it('keeps typed text and the loaded list across a language change', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [team('Platform')],
    } as Response);

    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', {
      route: '/teams',
      auth: { isAdmin: true },
    });
    await screen.findByRole('listitem');

    await userEvent.type(screen.getByLabelText(en.teams.nameLabel), 'Half typed');
    const requestsBefore = fetchMock.mock.calls.length;

    await userEvent.click(screen.getByRole('button', { name: en.language.switchToPl }));

    // The field keeps what was typed, under its now-Polish label...
    expect(await screen.findByLabelText(pl.teams.nameLabel)).toHaveValue('Half typed');
    // ...and the list is still there, not refetched.
    expect(screen.getByRole('listitem')).toHaveTextContent('Platform');
    expect(fetchMock.mock.calls.length).toBe(requestsBefore);
  });
});
