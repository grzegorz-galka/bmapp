/**
 * The route table and the shell every page renders inside.
 * See "The application opens at the dashboard", "Every page carries the
 * navigation menu" and "Configuration groups the configuration pages" in
 * specs/dashboard/spec.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoutes } from './routes';
import { renderWithLanguage } from './test/render';
import { AddressProbe } from './test/AddressProbe';
import { en } from './i18n/en';
import { pl } from './i18n/pl';
import { dashboardSummary } from './features/dashboard/dashboardFixture';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => (String(url).includes('/dashboard') ? dashboardSummary() : []),
    } as Response),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const nav = () => screen.getByRole('navigation', { name: en.nav.label });
const configuration = () => within(nav()).getByRole('button', { name: en.nav.configuration });

/** Open the Configuration group and choose one of its pages. */
async function chooseConfiguration(name: string) {
  await userEvent.click(configuration());
  await userEvent.click(within(nav()).getByRole('link', { name }));
}

describe('the route table', () => {
  it('The root address shows the dashboard', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', { route: '/' });

    expect(
      await screen.findByRole('heading', { name: en.dashboard.heroTitle }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: en.teams.heading })).not.toBeInTheDocument();
  });

  it('The teams address can be opened directly', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', {
      route: '/teams',
    });

    expect(await screen.findByRole('heading', { name: en.teams.heading })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: en.dashboard.heroTitle })).not.toBeInTheDocument();
  });

  it("shows a team's members page at its own address", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () =>
          String(url).includes('/dashboard')
            ? dashboardSummary()
            : {
                id: 'team-1',
                name: 'Platform',
                board: { id: 'board-1', name: 'Platform', schedule: null },
                members: [{ employee_id: 'emp-1', email: 'anna@example.com', is_leader: true }],
              },
      } as Response),
    );

    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', {
      route: '/teams/team-1/members',
    });

    expect(await screen.findByRole('heading', { name: 'Members of Platform' })).toBeInTheDocument();
    // A team's own pages belong to that team, not to the register of teams.
    expect(configuration()).not.toHaveAttribute('aria-current');
  });

  it('shows the global metrics page at its own address, linked from the header', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', { route: '/' });
    await screen.findByRole('heading', { name: en.dashboard.heroTitle });

    await chooseConfiguration(en.nav.globalMetrics);

    expect(
      await screen.findByRole('heading', { name: en.globalMetrics.heading }),
    ).toBeInTheDocument();
    expect(configuration()).toHaveAttribute('aria-current', 'page');
  });

  it('An unknown address falls back to the dashboard', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', {
      route: '/nothing-here',
    });

    expect(
      await screen.findByRole('heading', { name: en.dashboard.heroTitle }),
    ).toBeInTheDocument();
  });

  it('The teams page keeps its own address', async () => {
    await renderWithLanguage(
      <>
        <AppRoutes completeSignIn={async () => true} />
        <AddressProbe />
      </>,
      'en',
      { route: '/' },
    );
    await screen.findByRole('heading', { name: en.dashboard.heroTitle });

    await chooseConfiguration(en.nav.teams);

    expect(await screen.findByRole('heading', { name: en.teams.heading })).toBeInTheDocument();
    expect(configuration()).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('address')).toHaveTextContent(/^\/teams$/);
  });

  it('navigates back to the dashboard', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', {
      route: '/teams',
    });
    await screen.findByRole('heading', { name: en.teams.heading });

    await userEvent.click(within(nav()).getByRole('link', { name: en.nav.dashboard }));

    expect(
      await screen.findByRole('heading', { name: en.dashboard.heroTitle }),
    ).toBeInTheDocument();
  });
});

describe('the dashboard destination', () => {
  it('The dashboard is named in the active language', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', { route: '/' });
    expect(within(nav()).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/');

    await userEvent.click(screen.getByRole('button', { name: en.language.switchToPl }));

    const polishNav = await screen.findByRole('navigation', { name: pl.nav.label });
    expect(within(polishNav).getByRole('link', { name: 'Pulpit' })).toHaveAttribute('href', '/');

    await userEvent.click(screen.getByRole('button', { name: pl.language.switchToEn }));
  });
});

describe('the header', () => {
  it('is on the dashboard and on the team page alike', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', { route: '/' });
    expect(nav()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.language.switchToPl })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.theme.switchToLight })).toBeInTheDocument();

    await chooseConfiguration(en.nav.teams);

    expect(nav()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.language.switchToPl })).toBeInTheDocument();
  });

  it('marks the destination currently being shown', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', {
      route: '/teams',
    });

    expect(configuration()).toHaveAttribute('aria-current', 'page');
    expect(within(nav()).getByRole('link', { name: en.nav.dashboard })).not.toHaveAttribute(
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

describe('the navigation menu', () => {
  it('The top-level destinations', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', { route: '/' });

    const entries = [
      ...within(nav()).getAllByRole('link'),
      ...within(nav()).getAllByRole('button'),
    ].map((node) => node.textContent);
    expect(entries).toEqual([
      en.nav.dashboard,
      en.nav.myTeams,
      en.nav.myMeetings,
      en.nav.myPulse,
      en.nav.configuration,
    ]);
    expect(within(nav()).queryByText(/archive/i)).not.toBeInTheDocument();
  });

  it('Configuration reveals its destinations', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', { route: '/' });
    expect(configuration()).toHaveAttribute('aria-expanded', 'false');
    expect(within(nav()).queryByRole('link', { name: en.nav.teams })).not.toBeInTheDocument();

    await userEvent.click(configuration());

    expect(configuration()).toHaveAttribute('aria-expanded', 'true');
    for (const name of [en.nav.teams, en.nav.teamMetrics, en.nav.globalMetrics]) {
      expect(within(nav()).getByRole('link', { name })).toBeInTheDocument();
    }

    await userEvent.click(configuration());

    expect(configuration()).toHaveAttribute('aria-expanded', 'false');
    expect(within(nav()).queryByRole('link', { name: en.nav.teams })).not.toBeInTheDocument();
  });

  it('folds Configuration away on Escape', async () => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', { route: '/' });
    await userEvent.click(configuration());

    await userEvent.keyboard('{Escape}');

    expect(configuration()).toHaveAttribute('aria-expanded', 'false');
    expect(configuration()).toHaveFocus();
  });

  it('A personal page keeps its own address', async () => {
    await renderWithLanguage(
      <>
        <AppRoutes completeSignIn={async () => true} />
        <AddressProbe />
      </>,
      'en',
      { route: '/' },
    );
    await screen.findByRole('heading', { name: en.dashboard.heroTitle });

    await userEvent.click(within(nav()).getByRole('link', { name: en.nav.myMeetings }));

    expect(
      await screen.findByRole('heading', { name: en.personal.meetingsHeading }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('address')).toHaveTextContent(/^\/my-meetings$/);
    expect(within(nav()).getByRole('link', { name: en.nav.myMeetings })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it.each([
    ['/my-teams', en.personal.teamsHeading],
    ['/my-meetings', en.personal.meetingsHeading],
    ['/my-pulse', en.personal.pulseHeading],
    ['/team-metrics', en.personal.teamMetricsHeading],
  ])('opens %s directly, as after a reload', async (route, heading) => {
    await renderWithLanguage(<AppRoutes completeSignIn={async () => true} />, 'en', { route });

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });
});
