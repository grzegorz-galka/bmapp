/**
 * The dashboard: the declarations, the viewer's teams and countdown, the
 * pictograms, and what it does when the summary does not arrive. The meeting
 * rows and the problems and tasks tile have their own test files.
 * See specs/dashboard/spec.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithLanguage } from '../../test/render';
import { changeLanguage } from '../../i18n';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import { AppHeader } from '../../components/AppHeader';
import { DashboardPage } from './DashboardPage';
import { dashboardSummary, NOW, TODAYS_MEETING } from './dashboardFixture';

const fetchMock = vi.fn();
const summary = dashboardSummary();

function respondWith(body: unknown) {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => body } as Response);
}

beforeEach(() => {
  // shouldAdvanceTime keeps Testing Library's own waiting working while the
  // countdown's interval stays under the test's control.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  respondWith(summary);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.localStorage.clear();
});

/** Render the dashboard and wait for the summary to land. */
async function renderDashboard(language: 'en' | 'pl' = 'en') {
  const result = await renderWithLanguage(<DashboardPage />, language);
  const band = language === 'pl' ? pl.declarations.band : en.declarations.band;
  await screen.findByRole('heading', { name: band });
  return result;
}

const declarations = () => screen.getByRole('region', { name: en.declarations.band });
const teamsPanel = () => screen.getByRole('region', { name: en.myTeams.heading });

describe('the declarations', () => {
  it('The declarations are displayed', async () => {
    await renderDashboard();
    const band = within(declarations());
    const { mission, vision, goals, values } = summary.declarations;

    for (const heading of [
      en.declarations.mission,
      en.declarations.vision,
      en.declarations.goals,
      en.declarations.values,
    ]) {
      expect(band.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    for (const statement of [mission, vision]) {
      expect(band.getByText(statement.headline.en)).toBeInTheDocument();
      expect(band.getByText(statement.body.en)).toBeInTheDocument();
    }

    const goalTexts = band
      .getByRole('heading', { name: en.declarations.goals })
      .parentElement!.querySelectorAll('li');
    expect([...goalTexts].map((node) => node.textContent)).toEqual(goals.map((goal) => goal.en));

    // Each value is under a heading naming it, in the order supplied.
    const valueHeadings = band.getAllByRole('heading', { level: 4 });
    expect(valueHeadings.map((node) => node.textContent)).toEqual(
      values.map((value) => value.name.en),
    );
    for (const value of values) {
      expect(band.getByText(value.description.en)).toBeInTheDocument();
    }
    expect(band.getByText(en.declarations.bandNote)).toBeInTheDocument();
  });

  it('The declarations follow a language change', async () => {
    await renderDashboard();
    const requestsBefore = fetchMock.mock.calls.length;
    const { mission, vision, goals, values } = summary.declarations;

    await changeLanguage('pl');

    expect(await screen.findByText(mission.headline.pl)).toBeInTheDocument();
    expect(screen.getByText(mission.body.pl)).toBeInTheDocument();
    expect(screen.getByText(vision.headline.pl)).toBeInTheDocument();
    expect(screen.getByText(goals[0]!.pl)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: values[0]!.name.pl })).toBeInTheDocument();
    expect(screen.queryByText(mission.headline.en)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBe(requestsBefore);

    await changeLanguage('en');
  });

  it('Each value has its pictogram', async () => {
    await renderDashboard();

    const pictograms = summary.declarations.values.map((value) => {
      const item = screen.getByRole('heading', { name: value.name.en }).closest('li')!;
      const svg = item.querySelector('svg');
      expect(svg).not.toBeNull();
      return svg!.innerHTML;
    });

    expect(new Set(pictograms).size).toBe(summary.declarations.values.length);
  });

  it('Pictograms are hidden from assistive technology', async () => {
    await renderDashboard();
    const band = declarations();

    const pictograms = band.querySelectorAll('svg');
    // Mission, vision, goals, and one per value.
    expect(pictograms).toHaveLength(3 + summary.declarations.values.length);
    for (const svg of pictograms) {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('focusable', 'false');
    }
    // The words are all there without them, and nothing in a heading is extra.
    expect(within(band).getByRole('heading', { name: en.declarations.mission })).toHaveTextContent(
      /^Mission$/,
    );
    expect(within(band).getByText(summary.declarations.goals[2]!.en)).toBeInTheDocument();
  });
});

describe('the teams', () => {
  it('Teams are listed in order of their next meeting', async () => {
    await renderDashboard();
    const list = within(teamsPanel()).getByRole('list');
    const rows = within(list).getAllByRole('listitem');

    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Platform Core');
    expect(rows[1]).toHaveTextContent('Payments');
    expect(rows[2]).toHaveTextContent('Infrastructure');
    expect(rows[0]).toHaveTextContent(en.myTeams.role_leader);
    expect(rows[0]).toHaveTextContent('Meets Thursday at 15:30');
    expect(rows[1]).toHaveTextContent(en.myTeams.role_member);
    expect(rows[1]).toHaveTextContent('Meets Tuesday at 13:30');
    // The next meeting, in the reader's time zone.
    expect(rows[1]).toHaveTextContent(/22 Sept?/);
    expect(screen.getByLabelText(en.myTeams.count.replace('{{count}}', '3'))).toHaveTextContent(
      '3',
    );
  });

  it('A team with no meeting and no schedule', async () => {
    await renderDashboard();
    const rows = within(within(teamsPanel()).getByRole('list')).getAllByRole('listitem');
    const infrastructure = rows[2]!;

    expect(infrastructure).toHaveTextContent('Infrastructure');
    expect(infrastructure).toHaveTextContent(en.myTeams.noSchedule);
    expect(infrastructure).toHaveTextContent(en.myTeams.noNextMeeting);
  });

  it('A viewer on no team', async () => {
    respondWith(dashboardSummary({ teams: [], meetings: [] }));

    await renderDashboard('pl');
    const panel = screen.getByRole('region', { name: pl.myTeams.heading });

    expect(within(panel).getByText(pl.myTeams.noTeams)).toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();

    await changeLanguage('en');
  });
});

describe('the countdown', () => {
  it('The countdown counts down to the nearest meeting', async () => {
    await renderDashboard();
    const panel = within(teamsPanel());
    const timer = panel.getByRole('timer', { name: en.myTeams.countdownLabel });

    // 2026-09-17T12:00Z to 13:30Z is 0 days, 1 hour, 30 minutes. Asserted as
    // 29: the clock has moved on a few milliseconds by the time it renders.
    expect(timer).toHaveTextContent(/00.*01.*29/);
    expect(timer.parentElement).toHaveTextContent('Platform Core');
    expect(timer.parentElement).toHaveTextContent(/17 Sept?/);
  });

  it('The countdown advances while the page is open', async () => {
    await renderDashboard();
    const timer = screen.getByRole('timer', { name: en.myTeams.countdownLabel });
    const before = timer.textContent;

    await vi.advanceTimersByTimeAsync(60_000);

    expect(timer.textContent).not.toBe(before);
  });

  it('A meeting that has started reads zero', async () => {
    respondWith(
      dashboardSummary({
        teams: [
          {
            ...summary.teams[0]!,
            next_meeting_at: new Date(NOW.getTime() - 3_600_000).toISOString(),
          },
        ],
      }),
    );

    await renderDashboard();
    const timer = screen.getByRole('timer', { name: en.myTeams.countdownLabel });

    expect(timer).toHaveTextContent(/00.*00.*00/);
    expect(timer.textContent).not.toContain('-');
  });
});

describe('the pictograms', () => {
  it('Every action has an icon and keeps its caption', async () => {
    respondWith(dashboardSummary({ meetings: [TODAYS_MEETING] }));

    await renderDashboard();

    for (const caption of [
      en.meetingsTile.prepare,
      en.meetingsTile.fillPulse,
      en.meetingsTile.start,
    ]) {
      // Named by its caption alone: the icon adds nothing to the name.
      const action = screen.getByRole('button', { name: caption });
      const icon = action.querySelector('svg');
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
    for (const caption of [
      en.itemsTile.problemsLink,
      en.itemsTile.tasksLink,
      en.itemsTile.archiveLink,
    ]) {
      for (const link of screen.getAllByRole('link', { name: caption })) {
        expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      }
    }
  });

  it('Every tile title has a pictogram', async () => {
    await renderDashboard();

    for (const title of [en.myTeams.heading, en.meetingsTile.heading, en.itemsTile.heading]) {
      const heading = screen.getByRole('heading', { name: title });
      const pictogram = heading.querySelector('svg');
      expect(pictogram).not.toBeNull();
      expect(pictogram).toHaveAttribute('aria-hidden', 'true');
    }
  });
});

describe('the identity', () => {
  it('The identity is displayed', async () => {
    await renderWithLanguage(
      <>
        <AppHeader />
        <DashboardPage />
      </>,
      'en',
      { auth: { email: 'g.galka@pse.pl' } },
    );
    await screen.findByRole('heading', { name: en.declarations.band });

    expect(within(screen.getByRole('banner')).getByText('g.galka@pse.pl')).toBeInTheDocument();
    expect(
      screen.getByText(en.itemsTile.assignedTo.replace('{{email}}', 'g.galka@pse.pl')),
    ).toBeInTheDocument();
  });
});

describe('loading and failure', () => {
  it('The dashboard reports that it is loading', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    await renderWithLanguage(<DashboardPage />, 'en');

    expect(screen.getByText(en.dashboard.loading)).toBeInTheDocument();
  });

  it('The dashboard reports a failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response);

    await renderWithLanguage(
      <>
        <AppHeader />
        <DashboardPage />
      </>,
      'pl',
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(pl.dashboard.loadFailed);
    // The parts that need no data are still there, and so are the controls.
    expect(screen.getByRole('heading', { name: pl.dashboard.heroTitle })).toBeInTheDocument();
    expect(screen.getByText(pl.dashboard.footerEnv)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: pl.nav.teams })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: pl.language.switchToEn })).toBeEnabled();

    await changeLanguage('en');
  });
});

describe('in Polish', () => {
  it('renders the page with no English interface text', async () => {
    await renderDashboard('pl');

    expect(screen.getByRole('heading', { name: pl.dashboard.heroTitle })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: pl.meetingsTile.heading })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: pl.itemsTile.heading })).toBeInTheDocument();
    expect(screen.queryByText(en.dashboard.heroTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(en.meetingsTile.prepare)).not.toBeInTheDocument();

    await changeLanguage('en');
  });
});
