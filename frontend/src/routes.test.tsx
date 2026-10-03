/**
 * The route table and the shell every page renders inside.
 * See "The application opens at the hub" in specs/hub/spec.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoutes } from './routes';
import { renderWithLanguage } from './test/render';
import { en } from './i18n/en';
import { hubSummary } from './features/hub/hubFixture';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => (String(url).includes('/hub') ? hubSummary() : []),
    } as Response),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const nav = () => screen.getByRole('navigation', { name: en.nav.label });

describe('the route table', () => {
  it('shows the hub at the root address', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', { route: '/' });

    expect(await screen.findByRole('heading', { name: en.hub.heroTitle })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: en.teams.heading })).not.toBeInTheDocument();
  });

  it('shows the team page at its own address', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', {
      route: '/teams',
    });

    expect(await screen.findByRole('heading', { name: en.teams.heading })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: en.hub.heroTitle })).not.toBeInTheDocument();
  });

  it("shows a team's members page at its own address", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () =>
          String(url).includes('/hub')
            ? hubSummary()
            : {
                id: 'team-1',
                name: 'Platform',
                board: { id: 'board-1', name: 'Platform' },
                members: [{ employee_id: 'emp-1', email: 'anna@example.com', is_leader: true }],
              },
      } as Response),
    );

    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', {
      route: '/teams/team-1/members',
    });

    expect(await screen.findByRole('heading', { name: 'Members of Platform' })).toBeInTheDocument();
    // Still under the team section, so the header says where the user is.
    expect(within(nav()).getByRole('link', { name: en.nav.teams })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('falls back to the hub for an address it does not recognise', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', {
      route: '/nothing-here',
    });

    expect(await screen.findByRole('heading', { name: en.hub.heroTitle })).toBeInTheDocument();
  });

  it('navigates to the team page without reloading', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', { route: '/' });
    await screen.findByRole('heading', { name: en.hub.heroTitle });

    await userEvent.click(within(nav()).getByRole('link', { name: en.nav.teams }));

    expect(await screen.findByRole('heading', { name: en.teams.heading })).toBeInTheDocument();
  });

  it('navigates back to the hub', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', {
      route: '/teams',
    });
    await screen.findByRole('heading', { name: en.teams.heading });

    await userEvent.click(within(nav()).getByRole('link', { name: en.nav.hub }));

    expect(await screen.findByRole('heading', { name: en.hub.heroTitle })).toBeInTheDocument();
  });
});

describe('the header', () => {
  it('is on the hub and on the team page alike', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', { route: '/' });
    expect(nav()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.language.switchToPl })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.theme.switchToLight })).toBeInTheDocument();

    await userEvent.click(within(nav()).getByRole('link', { name: en.nav.teams }));

    expect(nav()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.language.switchToPl })).toBeInTheDocument();
  });

  it('marks the destination currently being shown', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', {
      route: '/teams',
    });

    expect(within(nav()).getByRole('link', { name: en.nav.teams })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav()).getByRole('link', { name: en.nav.hub })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('shows the identity of the signed-in person, with a way out of the session', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', {
      route: '/',
      auth: { email: 'jan.kowalski@pse.pl' },
    });

    expect(await screen.findByText('jan.kowalski@pse.pl')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /account: jan\.kowalski@pse\.pl/i }),
    ).toHaveTextContent(en.auth.signOut);
  });

  it('offers the sign-in and no identity when nobody is signed in', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', {
      route: '/',
      auth: { email: null },
    });

    expect(await screen.findByRole('button', { name: en.auth.signIn })).toBeInTheDocument();
    expect(screen.queryByText('jan.kowalski@pse.pl')).not.toBeInTheDocument();
  });
});

describe('the archive destination', () => {
  it('is named but exposed as unavailable', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', { route: '/' });

    const archive = within(nav()).getByText(en.nav.archive, { exact: false });
    expect(archive).toHaveAttribute('aria-disabled', 'true');
    expect(archive).toHaveTextContent(en.nav.notYetAvailable);
  });

  it('changes neither the page nor the address when activated', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', { route: '/' });
    await screen.findByRole('heading', { name: en.hub.heroTitle });

    await userEvent.click(within(nav()).getByText(en.nav.archive, { exact: false }));

    expect(screen.getByRole('heading', { name: en.hub.heroTitle })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('is not a followable link', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', { route: '/' });

    const archive = within(nav()).getByText(en.nav.archive, { exact: false });
    expect(archive).not.toHaveAttribute('href');
  });
});
