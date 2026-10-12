/**
 * The hub: what it shows, in both languages, and what it does when the
 * summary does not arrive. See specs/hub/spec.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useParams } from 'react-router';
import { renderWithLanguage } from '../../test/render';
import { changeLanguage } from '../../i18n';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import { HubPage } from './HubPage';
import { hubSummary, NOW } from './hubFixture';

const fetchMock = vi.fn();
const summary = hubSummary();

beforeEach(() => {
  // shouldAdvanceTime keeps Testing Library's own waiting working while the
  // countdown's interval stays under the test's control.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => summary } as Response);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.localStorage.clear();
});

/** Where the router lands when an item is chosen: the team's board. */
function BoardStandIn() {
  const { teamId } = useParams();
  return <p>the board of {teamId}</p>;
}

/** Render the hub and wait for the summary to land. */
async function renderHub(language: 'en' | 'pl' = 'en') {
  const result = await renderWithLanguage(<HubPage />, language);
  const band = language === 'pl' ? pl.declarations.band : en.declarations.band;
  await screen.findByRole('heading', { name: band });
  return result;
}

describe('the declarations band', () => {
  it('shows the mission, the vision and every goal and value in order', async () => {
    await renderHub();

    expect(screen.getByText(summary.declarations.mission.en)).toBeInTheDocument();
    expect(screen.getByText(summary.declarations.vision.en)).toBeInTheDocument();

    const goals = screen.getAllByRole('listitem').map((node) => node.textContent);
    for (const goal of summary.declarations.goals) {
      expect(goals.some((text) => text?.includes(goal.en))).toBe(true);
    }
    for (const value of summary.declarations.values) {
      expect(screen.getByText(value.en)).toBeInTheDocument();
    }
  });

  it('says the declarations appear on every board', async () => {
    await renderHub();

    expect(screen.getByText(en.declarations.bandNote)).toBeInTheDocument();
  });

  it('redisplays in Polish on a language change, without fetching again', async () => {
    await renderHub();
    const requestsBefore = fetchMock.mock.calls.length;

    await changeLanguage('pl');

    expect(await screen.findByText(summary.declarations.mission.pl)).toBeInTheDocument();
    expect(screen.getByText(summary.declarations.goals[0]!.pl)).toBeInTheDocument();
    expect(screen.queryByText(summary.declarations.mission.en)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBe(requestsBefore);

    await changeLanguage('en');
  });
});

describe('the teams panel', () => {
  it('lists every team with its role, slot, next meeting and readiness', async () => {
    await renderHub();
    const panel = screen.getByRole('region', { name: en.myTeams.heading });
    // Scoped to the list: the soonest team also appears in the nearest-meeting
    // block above it.
    const list = within(panel).getByRole('list');

    expect(within(list).getByText('Payments')).toBeInTheDocument();
    expect(within(list).getByText('Platform Core')).toBeInTheDocument();
    expect(within(list).getByText(/Team leader/)).toBeInTheDocument();
    expect(within(list).getByText(/Member/)).toBeInTheDocument();
    // The weekly slot, read off the next occurrence.
    expect(within(list).getByText(/Tuesday/)).toBeInTheDocument();
  });

  it('orders the teams with the soonest meeting first', async () => {
    await renderHub();
    const panel = screen.getByRole('region', { name: en.myTeams.heading });

    const names = within(panel)
      .getAllByRole('listitem')
      .map((node) => node.textContent ?? '');

    expect(names[0]).toContain('Payments');
    expect(names[1]).toContain('Platform Core');
  });

  it('shows how many teams the user belongs to', async () => {
    await renderHub();

    expect(
      screen.getByLabelText(en.myTeams.count.replace('{{count}}', String(summary.teams.length))),
    ).toBeInTheDocument();
  });

  it('states readiness in words, not only in colour', async () => {
    await renderHub();
    const panel = screen.getByRole('region', { name: en.myTeams.heading });

    expect(within(panel).getByText(en.myTeams.ready)).toBeInTheDocument();
    expect(
      within(panel).getByText(en.myTeams.metricsMissing.replace('{{count}}', '3')),
    ).toBeInTheDocument();
  });
});

describe('the countdown', () => {
  it('counts down to the nearest meeting', async () => {
    await renderHub();
    const timer = screen.getByRole('timer', { name: en.myTeams.countdownLabel });

    // 2026-09-17T12:00Z to 2026-09-22T11:30Z is 4 days, 23 hours, 30 minutes.
    // Deliberately off the hour: on an exact boundary a millisecond of drift
    // would flip the hours and make the assertion a coin toss.
    expect(timer).toHaveTextContent('04');
    expect(timer).toHaveTextContent('23');
    expect(timer).toHaveTextContent('29');
  });

  it('advances while the page stays open', async () => {
    await renderHub();
    const timer = screen.getByRole('timer', { name: en.myTeams.countdownLabel });
    const before = timer.textContent;

    await vi.advanceTimersByTimeAsync(60_000);

    expect(timer.textContent).not.toBe(before);
  });

  it('reads zero for a meeting that is not in the future', async () => {
    const past = hubSummary({
      teams: [
        {
          ...summary.teams[0]!,
          next_meeting_at: new Date(NOW.getTime() - 3_600_000).toISOString(),
        },
      ],
    });
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => past } as Response);

    await renderHub();
    const timer = screen.getByRole('timer', { name: en.myTeams.countdownLabel });

    expect(timer).toHaveTextContent('00');
    expect(timer.textContent).not.toContain('-');
  });
});

describe('the entry points', () => {
  it('shows all five, titled and described in the active language', async () => {
    await renderHub();

    for (const title of [
      en.tiles.configureTitle,
      en.tiles.prepareTitle,
      en.tiles.conductTitle,
      en.tiles.browseTitle,
      en.tiles.accessTitle,
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(screen.getByText(en.tiles.conductBody)).toBeInTheDocument();
  });

  it('shows the preparation counts against the preparation entry point', async () => {
    await renderHub();

    // Scoped to the tile: the funnel shows some of the same figures.
    const tile = screen.getByRole('heading', { name: en.tiles.prepareTitle }).closest('section');
    expect(tile).not.toBeNull();
    const prepare = within(tile!);

    expect(prepare.getByText(en.tiles.metricsDue)).toBeInTheDocument();
    expect(prepare.getByText(en.tiles.problemsReview)).toBeInTheDocument();
    expect(prepare.getByText(en.tiles.openTasks)).toBeInTheDocument();
    expect(prepare.getByText('7')).toBeInTheDocument();
    expect(prepare.getByText('4')).toBeInTheDocument();
    expect(prepare.getByText('11')).toBeInTheDocument();
  });

  it('indicates that a meeting is in session', async () => {
    await renderHub();

    expect(screen.getByText(en.tiles.inSession)).toBeInTheDocument();
  });

  it('says every entry point is not yet available, and none of them navigates', async () => {
    await renderHub();

    const notes = screen.getAllByText(en.nav.notYetAvailable);
    expect(notes).toHaveLength(5);
    for (const note of notes) {
      expect(note.closest('[aria-disabled="true"]')).not.toBeNull();
    }
    expect(screen.queryByRole('link', { name: en.tiles.conductTitle })).not.toBeInTheDocument();
  });
});

describe('the funnel', () => {
  it('Each funnel stage shows its figures', async () => {
    await renderHub();
    const funnel = screen.getByRole('region', { name: en.funnel.heading });

    expect(within(funnel).getByText(en.funnel.stage_open)).toBeInTheDocument();
    expect(within(funnel).getByText(en.funnel.stage_in_progress)).toBeInTheDocument();
    expect(within(funnel).getByText(en.funnel.stage_archived)).toBeInTheDocument();
    // Totals are summed from the split, not sent.
    const totals = within(funnel)
      .getAllByRole('listitem')
      .map((stage) => stage.textContent ?? '');
    expect(totals[0]).toContain('18');
    expect(totals[1]).toContain('11');
    expect(totals[2]).toContain('64');
    expect(
      within(funnel).getByText(
        en.funnel.split.replace('{{problems}}', '11').replace('{{tasks}}', '7'),
      ),
    ).toBeInTheDocument();
  });

  it('The funnel states what it covers', async () => {
    await renderHub();

    expect(screen.getByText(en.funnel.scope.replace('{{count}}', '2'))).toBeInTheDocument();
  });

  it('states the scope in Polish when Polish is active', async () => {
    await renderHub('pl');

    expect(screen.getByText(pl.funnel.scope.replace('{{count}}', '2'))).toBeInTheDocument();

    await changeLanguage('en');
  });

  it('says archived items are closed, never deleted', async () => {
    await renderHub();

    expect(screen.getByText(en.funnel.footRight)).toBeInTheDocument();
  });
});

describe('the assigned items', () => {
  it('Assigned items are displayed', async () => {
    await renderHub();
    const list = screen.getByRole('region', { name: en.items.heading });
    const [first] = within(list).getAllByRole('listitem');
    const item = within(first!);

    expect(item.getByText(en.items.kind_problem)).toBeInTheDocument();
    expect(item.getByText('Deploy pipeline flaky')).toBeInTheDocument();
    expect(item.getByText('Platform Core')).toBeInTheDocument();
    // The stage is named in words beside the ball, not shown as a percentage.
    expect(item.getByText(en.pdca.do)).toBeInTheDocument();
    expect(item.getByText(/^Due /)).toBeInTheDocument();
    expect(within(list).getByText(en.pdca.plan)).toBeInTheDocument();
  });

  it('shows a summary as it was typed, whatever the active language', async () => {
    await renderHub('pl');
    const list = screen.getByRole('region', { name: pl.items.heading });

    expect(within(list).getByText('Deploy pipeline flaky')).toBeInTheDocument();
    expect(within(list).getByText('Skrócić czas realizacji poniżej 5 dni')).toBeInTheDocument();
    expect(within(list).getByText(pl.pdca.do)).toBeInTheDocument();

    await changeLanguage('en');
  });

  it('says so when an item has no due date', async () => {
    await renderHub();
    const list = screen.getByRole('region', { name: en.items.heading });

    expect(within(list).getByText(en.items.noDueDate)).toBeInTheDocument();
  });

  it('An assigned item leads to its board', async () => {
    await renderWithLanguage(
      <Routes>
        <Route path="/" element={<HubPage />} />
        <Route path="/teams/:teamId" element={<BoardStandIn />} />
      </Routes>,
      'en',
    );
    const list = await screen.findByRole('region', { name: en.items.heading });

    expect(within(list).getByRole('link', { name: 'Write the runbook' })).toHaveAttribute(
      'href',
      '/teams/payments',
    );
    await userEvent.click(within(list).getByRole('link', { name: 'Deploy pipeline flaky' }));

    expect(await screen.findByText('the board of platform-core')).toBeInTheDocument();
  });

  it('offers no control to move a stage from the hub', async () => {
    await renderHub();
    const list = screen.getByRole('region', { name: en.items.heading });

    expect(within(list).queryByRole('button')).not.toBeInTheDocument();
  });

  it('An overdue item is distinguished', async () => {
    await renderHub();
    const list = screen.getByRole('region', { name: en.items.heading });

    expect(within(list).getByText(en.items.overdue)).toBeInTheDocument();
    // Exactly one fixture item is overdue; one is on time and one has no date.
    expect(within(list).getAllByText(en.items.overdue)).toHaveLength(1);
  });

  it('heads the list with whose items they are', async () => {
    await renderHub();

    expect(
      screen.getByText(en.items.assignedTo.replace('{{email}}', 'g.galka@pse.pl')),
    ).toBeInTheDocument();
  });

  it('The user has no assigned items', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => hubSummary({ assigned_items: [] }),
    } as Response);

    await renderHub();

    expect(screen.getByText(en.items.empty)).toBeInTheDocument();
  });
});

describe('loading and failure', () => {
  it('says it is loading before the summary arrives', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    await renderWithLanguage(<HubPage />, 'en');

    expect(screen.getByText(en.hub.loading)).toBeInTheDocument();
  });

  it('says it could not load, in Polish, when the request fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response);

    await renderWithLanguage(<HubPage />, 'pl');

    expect(await screen.findByRole('alert')).toHaveTextContent(pl.hub.loadFailed);

    await changeLanguage('en');
  });

  it('leaves the page usable when the summary fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response);

    await renderWithLanguage(<HubPage />, 'en');
    await screen.findByRole('alert');

    // The parts that need no data are still there.
    expect(screen.getByRole('heading', { name: en.hub.heroTitle })).toBeInTheDocument();
    expect(screen.getByText(en.hub.footerEnv)).toBeInTheDocument();
  });
});

describe('the provisional marker', () => {
  it('says the figures are placeholder data', async () => {
    await renderHub();

    expect(screen.getByText(en.hub.provisional)).toBeInTheDocument();
  });
});

describe('in Polish', () => {
  it('renders the whole page with no English text', async () => {
    await renderHub('pl');

    expect(screen.getByRole('heading', { name: pl.hub.heroTitle })).toBeInTheDocument();
    expect(screen.getByText(pl.declarations.bandNote)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: pl.tiles.conductTitle })).toBeInTheDocument();
    expect(screen.getByText(pl.funnel.stage_archived)).toBeInTheDocument();
    expect(screen.queryByText(en.hub.heroTitle)).not.toBeInTheDocument();

    await changeLanguage('en');
  });
});

describe('the user', () => {
  it('takes the identity from the fetched summary', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => hubSummary({ current_user: { email: 'someone@pse.pl', initials: 'SX' } }),
    } as Response);

    await renderHub();

    expect(
      screen.getByText(en.items.assignedTo.replace('{{email}}', 'someone@pse.pl')),
    ).toBeInTheDocument();
  });

  it('offers no sign-in, sign-out or account control', async () => {
    await renderHub();

    for (const name of [/sign in/i, /sign out/i, /log in/i, /log out/i, /account/i]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
  });
});
