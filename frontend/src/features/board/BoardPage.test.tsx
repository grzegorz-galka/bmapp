/**
 * The board page. One test per scenario of "The board page" in
 * specs/metric-values/spec.md, then what each tile and the navigator show.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Route, Routes, useLocation } from 'react-router';
import { BoardPage, defaultMeeting } from './BoardPage';
import { renderWithLanguage } from '../../test/render';
import { AddressProbe } from '../../test/AddressProbe';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import type { Language } from '../../i18n/languages';
import controls from '../../styles/controls.module.css';
import {
  board,
  definition,
  LEADER,
  MEETINGS,
  MEMBER,
  MONDAY,
  noItems,
  problem,
  pulseResults,
  serveBoard,
  SEVEN_ANSWERS,
  TEAM_ID,
  tile,
  TREND,
  type Fixtures,
  jsonResponse,
} from './boardFixture';

const fetchMock = vi.fn();
let fixtures: Fixtures;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MONDAY);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fixtures = {
    boards: Object.fromEntries(MEETINGS.meetings.map((m) => [m.id, board(m.date)])),
    trend: TREND,
    write: () => jsonResponse({}),
  };
  serveBoard(fetchMock, fixtures);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function renderBoard(
  language: Language = 'en',
  auth: { email?: string; isAdmin?: boolean } = { email: MEMBER },
  route = `/teams/${TEAM_ID}`,
) {
  await renderWithLanguage(
    <Routes>
      <Route path="/teams/:teamId" element={<BoardPage />} />
    </Routes>,
    language,
    { route, auth },
  );
  const catalogue = language === 'en' ? en : pl;
  await screen.findByRole('heading', {
    name: catalogue.board.heading.replace('{{name}}', 'Platform'),
  });
}

function meetingShown(): string {
  return (screen.getByLabelText(en.board.meetingSelectLabel) as HTMLSelectElement).value;
}

function boardRequests(): string[] {
  return (fetchMock.mock.calls as [string][])
    .map(([url]) => url)
    .filter((url) => url.endsWith('/board'));
}

describe('the board page', () => {
  it('opens on the coming meeting', async () => {
    // Scenario: The board opens on the coming meeting.
    await renderBoard();

    expect(meetingShown()).toBe('m-2026-10-14');
    expect(await screen.findByRole('heading', { name: 'Revenue' })).toBeInTheDocument();
    expect(boardRequests()).toEqual([`/api/teams/${TEAM_ID}/meetings/m-2026-10-14/board`]);
  });

  it('opens on a meeting held today', () => {
    expect(defaultMeeting(MEETINGS.meetings, '2026-10-14')?.date).toBe('2026-10-14');
  });

  it('opens on the latest meeting when none is still to come', () => {
    expect(defaultMeeting(MEETINGS.meetings, '2026-11-02')?.date).toBe('2026-10-21');
    expect(defaultMeeting([], '2026-11-02')).toBeUndefined();
  });

  it('gives the status and the colour set by hand in words, never colour alone', async () => {
    // Scenario: Colour is never the only signal.
    fixtures.boards['m-2026-10-14'] = board('2026-10-14', {
      metrics: [
        tile(),
        tile({
          metric: definition({ id: 'metric-bugs', name: 'Open bugs' }),
          status: 'red',
          set_by_hand: true,
          manual_status: 'red',
          comment: 'Release slipped',
        }),
        tile({
          metric: definition({ id: 'metric-nps', name: 'NPS' }),
          status: 'green',
          value: '96',
        }),
      ],
    });
    await renderBoard();

    const tiles = within(await screen.findByRole('region', { name: 'Finance' })).getAllByRole(
      'listitem',
    );
    expect(tiles[0]).toHaveTextContent(en.status.amber);
    expect(tiles[1]).toHaveTextContent(`${en.status.red}${en.status.setByHand}`);
    expect(tiles[1]).toHaveTextContent('Release slipped');
    expect(tiles[2]).toHaveTextContent(en.status.green);
  });

  it('says a board without metrics has none, and links a leader to the settings', async () => {
    // Scenario: A board without metrics.
    fixtures.boards['m-2026-10-14'] = board('2026-10-14', {
      metrics: [],
      completeness: { recorded: 0, total: 0, missing: [], owing: 0 },
    });
    await renderBoard('en', { email: LEADER });

    expect(await screen.findByText(en.board.noMetrics)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.board.configureLink })).toHaveAttribute(
      'href',
      `/teams/${TEAM_ID}/metrics`,
    );
  });

  it('does not offer the settings link in that message to a member', async () => {
    fixtures.boards['m-2026-10-14'] = board('2026-10-14', { metrics: [] });
    await renderBoard('en', { email: MEMBER });

    expect(await screen.findByText(en.board.noMetrics)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: en.board.configureLink })).not.toBeInTheDocument();
  });

  it('shows each tile’s value, change, threshold and sparkline', async () => {
    await renderBoard();

    const tileItem = (await screen.findByRole('heading', { name: 'Revenue' })).closest('li')!;
    expect(tileItem).toHaveTextContent('90.0 %');
    expect(tileItem).toHaveTextContent('+5.0 % since the last meeting · better');
    expect(tileItem).toHaveTextContent('Green from 95.0 %, amber from 85.0 %');
    expect(
      within(tileItem).getByRole('img', { name: 'Revenue over the last meetings: 2' }),
    ).toBeInTheDocument();
  });

  it('names a global metric as global on its tile, in words and by a symbol', async () => {
    // Scenario: A tile names a global metric as global (specs/global-metrics).
    fixtures.boards['m-2026-10-14'] = board('2026-10-14', {
      metrics: [
        tile(),
        tile({
          metric: definition({ id: 'metric-availability', name: 'Availability', scope: 'global' }),
        }),
      ],
    });
    await renderBoard();

    const global = (await screen.findByRole('heading', { name: 'Availability' })).closest('li')!;
    const mark = within(global).getByText(en.metrics.global);
    expect(mark.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    const own = screen.getByRole('heading', { name: 'Revenue' }).closest('li')!;
    expect(within(own).queryByText(en.metrics.global)).not.toBeInTheDocument();
  });

  it('marks a global metric in Polish too', async () => {
    fixtures.boards['m-2026-10-14'] = board('2026-10-14', {
      metrics: [tile({ metric: definition({ scope: 'global' }) })],
    });
    await renderBoard('pl');

    const tileItem = (await screen.findByRole('heading', { name: 'Revenue' })).closest('li')!;
    expect(within(tileItem).getByText(pl.metrics.global)).toBeInTheDocument();
  });

  it('marks a decline as worse, and a band’s change as neither', async () => {
    fixtures.boards['m-2026-10-14'] = board('2026-10-14', {
      metrics: [
        tile({ change: '-2', improvement: false }),
        tile({
          metric: definition({ id: 'metric-band', name: 'Band', direction: 'within_band' }),
          change: '0.5',
          improvement: null,
        }),
        tile({
          metric: definition({ id: 'metric-new', name: 'New' }),
          previous: null,
          change: null,
          improvement: null,
        }),
      ],
    });
    await renderBoard();

    const tiles = within(await screen.findByRole('region', { name: 'Finance' })).getAllByRole(
      'listitem',
    );
    expect(tiles[0]).toHaveTextContent('-2.0 % since the last meeting · worse');
    expect(tiles[1]).toHaveTextContent('+0.5 % since the last meeting');
    expect(tiles[1]).not.toHaveTextContent(/better|worse/);
    expect(tiles[2]).toHaveTextContent(en.board.noChange);
  });

  it("Tiles follow the board's layout", async () => {
    const finance = { id: 'g-finance', name: 'Finance', position: 0 };
    const quality = { id: 'g-quality', name: 'Quality', position: 1 };
    // "Delivery" (position 2) holds no metric, so nothing on the board names it.
    const at = (name: string, group: typeof finance | null, position: number) =>
      tile({ metric: definition({ id: `metric-${name}`, name, group, position }) });
    fixtures.boards['m-2026-10-14'] = board('2026-10-14', {
      metrics: [
        at('Morale', null, 0),
        at('Bugs', quality, 1),
        at('Revenue', finance, 0),
        at('Defects', quality, 0),
      ],
    });
    await renderBoard();

    await screen.findByRole('region', { name: 'Finance' });
    const sections = screen
      .getAllByRole('region')
      .filter((region) =>
        ['Finance', 'Quality', en.board.noGroup].includes(region.ariaLabel ?? ''),
      );
    expect(sections.map((region) => region.getAttribute('aria-label'))).toEqual([
      'Finance',
      'Quality',
      en.board.noGroup,
    ]);
    const names = (region: HTMLElement) =>
      within(region)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent);
    expect(names(sections[1]!)).toEqual(['Defects', 'Bugs']);
    expect(names(sections[2]!)).toEqual(['Morale']);
    expect(screen.queryByRole('region', { name: 'Delivery' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Delivery' })).not.toBeInTheDocument();
  });

  it('moves between meetings and remembers which one in the address', async () => {
    const user = userEvent.setup();
    await renderBoard();

    await user.click(screen.getByRole('button', { name: `← ${en.board.previousMeeting}` }));

    expect(meetingShown()).toBe('m-2026-10-07');
    expect(boardRequests().at(-1)).toBe(`/api/teams/${TEAM_ID}/meetings/m-2026-10-07/board`);
    await user.selectOptions(screen.getByLabelText(en.board.meetingSelectLabel), 'm-2026-09-30');
    expect(meetingShown()).toBe('m-2026-09-30');
    expect(screen.getByRole('button', { name: `← ${en.board.previousMeeting}` })).toBeDisabled();
  });

  it('opens on the meeting the address names', async () => {
    await renderBoard('en', { email: MEMBER }, `/teams/${TEAM_ID}?meeting=m-2026-09-30`);

    expect(meetingShown()).toBe('m-2026-09-30');
  });

  it('says when a team has no meetings yet', async () => {
    const served = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      url.endsWith('/meetings')
        ? Promise.resolve(jsonResponse({ ...MEETINGS, meetings: [] }))
        : served(url, init),
    );
    await renderBoard();

    expect(screen.getByText(en.board.noMeetings)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.board.openMeetingLink })).toHaveAttribute(
      'href',
      `/teams/${TEAM_ID}/meetings`,
    );
  });

  it('opens a metric’s detail over the board and closes it again', async () => {
    const user = userEvent.setup();
    await renderBoard();

    await user.click(await screen.findByRole('button', { name: 'Details: Revenue' }));
    const dialog = screen.getByRole('dialog', { name: 'Revenue' });
    expect(await within(dialog).findByText('Ahead of plan')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reads in Polish, numbers included', async () => {
    await renderBoard('pl');

    const tileItem = (await screen.findByRole('heading', { name: 'Revenue' })).closest('li')!;
    expect(tileItem).toHaveTextContent('90,0 %');
    expect(tileItem).toHaveTextContent('+5,0 % od ostatniego spotkania · lepiej');
    expect(tileItem).toHaveTextContent(pl.status.amber);
    expect(screen.getByRole('option', { name: 'Spotkanie śr., 14 paź 2026' })).toBeInTheDocument();
  });

  it('links to the meetings page and the metric settings', async () => {
    await renderBoard();

    expect(screen.getByRole('link', { name: en.board.meetingsLink })).toHaveAttribute(
      'href',
      `/teams/${TEAM_ID}/meetings`,
    );
    expect(screen.getByRole('link', { name: en.board.settingsLink })).toHaveAttribute(
      'href',
      `/teams/${TEAM_ID}/metrics`,
    );
  });

  it('shows a meeting that no longer exists as an error, not a blank board', async () => {
    delete fixtures.boards['m-2026-10-14'];
    await renderBoard();

    expect(await screen.findByRole('alert')).toHaveTextContent(en.errors['meeting.not_found']);
  });
});

function Address() {
  const location = useLocation();
  return <output data-testid="address">{location.search}</output>;
}

async function renderWithAddress(query: string) {
  await renderWithLanguage(
    <Routes>
      <Route
        path="/teams/:teamId"
        element={
          <>
            <BoardPage />
            <Address />
          </>
        }
      />
    </Routes>,
    'en',
    { route: `/teams/${TEAM_ID}${query}`, auth: { email: MEMBER } },
  );
  await screen.findByRole('heading', { name: en.board.heading.replace('{{name}}', 'Platform') });
}

function address(): URLSearchParams {
  return new URLSearchParams(screen.getByTestId('address').textContent ?? '');
}

describe("the board's controls follow the one button scheme", () => {
  // specs/appearance/spec.md. jsdom applies no CSS-module styles, so the look
  // is asserted by class: what each class draws is pinned by controls.test.ts.
  const BUTTON = controls.button!;
  const DEFAULT = controls.default!;
  const SEGMENTED = controls.segmented!;
  const LINK = controls.link!;

  it('The chosen view is filled', async () => {
    await renderBoard();

    const views = screen.getByRole('group', { name: en.pulse.viewSwitchLabel });
    expect(views).toHaveClass(SEGMENTED);
    const segments = within(views).getAllByRole('button');
    expect(segments[0]).toHaveTextContent(en.pulse.metricsView);
    expect(segments[0]).toHaveAttribute('aria-pressed', 'true');
    for (const other of segments.slice(1)) {
      expect(other).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it("The board's own links are links", async () => {
    await renderBoard();

    for (const name of [en.board.meetingsLink, en.board.settingsLink]) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveClass(LINK);
      expect(link).not.toHaveClass(BUTTON);
      // The icon is a picture only: the caption alone names the link.
      expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
    for (const name of [en.board.previousMeeting, en.board.nextMeeting]) {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toHaveClass(BUTTON);
    }
  });

  it('fills the Record values toggle only while it is pressed', async () => {
    const user = userEvent.setup();
    await renderBoard();

    const off = await screen.findByRole('button', { name: en.board.record });
    expect(off).toHaveClass(BUTTON);
    expect(off).not.toHaveClass(DEFAULT);
    expect(off).toHaveAttribute('aria-pressed', 'false');

    await user.click(off);

    const on = await screen.findByRole('button', { name: en.board.showTiles });
    expect(on).toHaveClass(BUTTON);
    expect(on).not.toHaveClass(DEFAULT);
    expect(on).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('the recording view has its own address', () => {
  it('The recording view survives a reload', async () => {
    const user = userEvent.setup();
    await renderWithAddress('?meeting=m-2026-10-07');
    await user.click(await screen.findByRole('button', { name: en.board.record }));

    expect(address().get('mode')).toBe('record');
    expect(address().get('meeting')).toBe('m-2026-10-07');

    const reloaded = `?${address().toString()}`;
    cleanup();
    await renderWithLanguage(
      <Routes>
        <Route path="/teams/:teamId" element={<BoardPage />} />
      </Routes>,
      'en',
      { route: `/teams/${TEAM_ID}${reloaded}`, auth: { email: MEMBER } },
    );

    expect(
      await screen.findByRole('region', { name: /Values at the meeting on/ }),
    ).toBeInTheDocument();
    expect(meetingShown()).toBe('m-2026-10-07');
    expect(screen.getByRole('button', { name: en.board.showTiles })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('Closing the recording view updates the address', async () => {
    const user = userEvent.setup();
    await renderWithAddress('?meeting=m-2026-10-14&mode=record');
    await screen.findByRole('region', { name: /Values at the meeting on/ });

    await user.click(screen.getByRole('button', { name: en.board.showTiles }));

    await waitFor(() => expect(address().get('mode')).toBeNull());
    expect(address().get('meeting')).toBe('m-2026-10-14');
    expect(
      screen.queryByRole('region', { name: /Values at the meeting on/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.board.record })).toBeInTheDocument();
  });

  it('keeps the recording view open when moving between meetings', async () => {
    const user = userEvent.setup();
    await renderWithAddress('?meeting=m-2026-10-14&mode=record');
    await screen.findByRole('region', { name: /Values at the meeting on/ });

    await user.click(screen.getByRole('button', { name: `← ${en.board.previousMeeting}` }));

    expect(address().get('meeting')).toBe('m-2026-10-07');
    expect(address().get('mode')).toBe('record');
  });

  it('ignores a recording mode asked of another view', async () => {
    await renderWithLanguage(
      <Routes>
        <Route path="/teams/:teamId" element={<BoardPage />} />
      </Routes>,
      'en',
      { route: `/teams/${TEAM_ID}?view=archived&mode=record`, auth: { email: MEMBER } },
    );

    await screen.findByRole('button', { name: en.archive.view, pressed: true });
    expect(
      screen.queryByRole('region', { name: /Values at the meeting on/ }),
    ).not.toBeInTheDocument();
  });
});

describe('the view switch counts the recorded metrics', () => {
  function countedBoard(recorded: number) {
    return board('2026-10-14', { completeness: { recorded, total: 14, missing: [], owing: 0 } });
  }

  it('The metrics switch shows the count', async () => {
    fixtures.boards['m-2026-10-14'] = countedBoard(12);
    await renderBoard();

    expect(await screen.findByRole('button', { name: 'Metrics 12/14' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('The count follows a recorded value', async () => {
    fixtures.boards['m-2026-10-14'] = countedBoard(12);
    fixtures.write = () => {
      fixtures.boards['m-2026-10-14'] = countedBoard(13);
      return jsonResponse({});
    };
    const user = userEvent.setup();
    await renderBoard('en', { email: MEMBER }, `/teams/${TEAM_ID}?mode=record`);
    await screen.findByRole('button', { name: 'Metrics 12/14' });

    const field = await screen.findByRole('textbox', { name: 'Value: Revenue' });
    await user.clear(field);
    await user.type(field, '95');
    await user.tab();

    expect(await screen.findByRole('button', { name: 'Metrics 13/14' })).toBeInTheDocument();
  });
});

describe("the board's back link", () => {
  /** The board, opened by an entry link that recorded where it was opened from. */
  async function renderFrom(from: unknown, language: Language = 'en', search = '') {
    await renderWithLanguage(
      <>
        <Routes>
          <Route path="/teams/:teamId" element={<BoardPage />} />
          <Route path="*" element={null} />
        </Routes>
        <AddressProbe />
      </>,
      language,
      {
        route: { pathname: `/teams/${TEAM_ID}`, search, state: { from } },
        auth: { email: MEMBER },
      },
    );
    await screen.findByRole('heading', {
      name: (language === 'en' ? en : pl).board.heading.replace('{{name}}', 'Platform'),
    });
  }

  const viewSwitch = () => screen.getByRole('group', { name: en.pulse.viewSwitchLabel });
  const viewButton = (index: number) => within(viewSwitch()).getAllByRole('button')[index]!;

  it('The board leads back to the screen it was opened from', async () => {
    await renderFrom({ screen: 'myMeetings', path: '/my-meetings' });

    await userEvent.click(screen.getByRole('link', { name: en.back.myMeetings }));

    expect(screen.getByTestId('address')).toHaveTextContent(/^\/my-meetings$/);
  });

  it("The board's own views keep the origin", async () => {
    const user = userEvent.setup();
    await renderFrom({ screen: 'dashboard', path: '/' });
    const back = () => screen.getByRole('link', { name: en.back.dashboard });

    await user.click(viewButton(1));
    expect(screen.getByTestId('address')).toHaveTextContent('view=pulse');
    expect(back()).toHaveAttribute('href', '/');

    await user.click(viewButton(2));
    expect(screen.getByTestId('address')).toHaveTextContent('view=archived');
    expect(back()).toHaveAttribute('href', '/');

    await user.click(viewButton(0));
    expect(screen.getByTestId('address')).not.toHaveTextContent('view=');
    expect(back()).toHaveAttribute('href', '/');

    // Opening the recording view and moving between meetings are view changes too.
    await user.click(await screen.findByRole('button', { name: en.board.record }));
    expect(screen.getByTestId('address')).toHaveTextContent('mode=record');
    expect(back()).toHaveAttribute('href', '/');
    await user.click(screen.getByRole('button', { name: `← ${en.board.previousMeeting}` }));
    expect(screen.getByTestId('address')).toHaveTextContent('meeting=m-2026-10-07');
    expect(back()).toHaveAttribute('href', '/');

    await user.click(back());
    expect(screen.getByTestId('address')).toHaveTextContent(/^\/$/);
  });

  it('The back link reads in Polish', async () => {
    await renderFrom({ screen: 'dashboard', path: '/' }, 'pl');

    expect(screen.getByRole('link', { name: pl.back.dashboard })).toHaveAttribute('href', '/');
  });

  it('passes itself, with its own origin, to the meetings page and the settings', async () => {
    const origin = { screen: 'myTeams', path: '/my-teams' };
    await renderFrom(origin, 'en', '?view=pulse');

    await userEvent.click(screen.getByRole('link', { name: en.board.meetingsLink }));

    expect(JSON.parse(screen.getByTestId('location-state').textContent!)).toEqual({
      from: { screen: 'board', path: `/teams/${TEAM_ID}?view=pulse`, state: { from: origin } },
    });
  });
});

describe('names can be hidden across the board', () => {
  const hideNames = () => screen.getByRole('checkbox', { name: en.pulse.hideNames });
  const viewSwitch = () => screen.getByRole('group', { name: en.pulse.viewSwitchLabel });
  /** Every email the page shows, wherever it is: an answer, a member, an owner, a responsible. */
  const namesShown = () => document.body.textContent?.match(/[\w.]+@example\.com/g) ?? [];
  // The fixture's answers quote their author; what a member writes is not hidden, only who.
  const anonymousTexts = SEVEN_ANSWERS.map((answer) => ({
    ...answer,
    positive: 'Calm week',
    negative: 'Flaky builds',
    better: 'Fewer interruptions',
  }));

  beforeEach(() => {
    fixtures.pulse = {
      'm-2026-10-14': pulseResults('m-2026-10-14', { answers: anonymousTexts }),
      'm-2026-10-21': pulseResults('m-2026-10-21', { answers: anonymousTexts }),
    };
    // A coming meeting at which Anna owes a value and four members an answer.
    fixtures.boards['m-2026-10-14'] = board('2026-10-14', {
      completeness: {
        recorded: 0,
        total: 1,
        missing: [
          {
            metric_id: 'metric-revenue',
            name: 'Revenue',
            owner: { id: 'emp-anna', email: LEADER },
          },
        ],
        owing: 5,
      },
    });
    fixtures.items = noItems();
    fixtures.items.problems.active = [
      problem({ responsible: { employee_id: 'emp-anna', email: LEADER } }),
    ];
  });

  /** The board's pulse check view of the coming meeting, with every name in. */
  async function openPulse() {
    const user = userEvent.setup();
    await renderBoard('en', { email: MEMBER }, `/teams/${TEAM_ID}?view=pulse`);
    await screen.findByRole('region', { name: en.pulse.answersHeading });
    return user;
  }

  it('Names are hidden', async () => {
    const user = await openPulse();

    await user.click(hideNames());

    const rows = within(screen.getByRole('region', { name: en.pulse.answersHeading }))
      .getAllByRole('row')
      .slice(1);
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual(
      [1, 2, 3, 4, 5, 6, 7].map((n) => `Person ${n}`),
    );
    expect(screen.getByRole('region', { name: en.pulse.answeredLabel })).toHaveTextContent(
      'Answers missing: 4',
    );
    expect(screen.queryByText(/@example\.com$/)).not.toBeInTheDocument();
  });

  it('Hidden names stay hidden across views', async () => {
    const user = await openPulse();
    expect(namesShown()).not.toEqual([]);
    await user.click(hideNames());
    expect(namesShown()).toEqual([]);

    // To the metrics: the readiness panel, the recording list and the problem.
    await user.click(within(viewSwitch()).getAllByRole('button')[0]!);
    // Expanded, so the panel is read as a viewer sees it.
    const panel = await screen.findByRole('group', { name: en.readiness.heading });
    await user.click(within(panel).getByRole('heading', { name: en.readiness.heading }));
    await waitFor(() => expect(panel).toHaveAttribute('open'));
    await screen.findByText('Builds are flaky');
    expect(hideNames()).toBeChecked();
    expect(namesShown()).toEqual([]);
    await user.click(screen.getByRole('button', { name: en.board.record }));
    await screen.findByText(new RegExp(en.recording.missing));
    expect(namesShown()).toEqual([]);

    // The archive, and back to the pulse check.
    await user.click(within(viewSwitch()).getAllByRole('button')[2]!);
    await screen.findByText(en.archive.empty);
    expect(namesShown()).toEqual([]);
    await user.click(within(viewSwitch()).getAllByRole('button')[1]!);
    await screen.findByRole('region', { name: en.pulse.answersHeading });
    expect(namesShown()).toEqual([]);

    // On to the next meeting.
    await user.click(screen.getByRole('button', { name: `${en.board.nextMeeting} →` }));
    await waitFor(() => expect(meetingShown()).toBe('m-2026-10-21'));
    await screen.findByRole('region', { name: en.pulse.answersHeading });
    expect(hideNames()).toBeChecked();
    expect(namesShown()).toEqual([]);
  });

  it('The readiness panel and the item lists name no one', async () => {
    const user = userEvent.setup();
    await renderBoard();
    const panel = await screen.findByRole('group', { name: en.readiness.heading });
    await user.click(within(panel).getByRole('heading', { name: en.readiness.heading }));
    await waitFor(() => expect(panel).toHaveAttribute('open'));
    await within(panel).findByText('hania@example.com');
    expect(within(panel).getByRole('button', { name: en.readiness.copy })).toBeInTheDocument();

    await user.click(hideNames());

    expect(panel).toHaveTextContent('5 people still owe data');
    expect(panel).toHaveTextContent('4 members have not answered');
    expect(within(panel).queryByRole('button', { name: en.readiness.copy })).toBeNull();
    const problems = screen.getByRole('region', { name: en.items.problemsHeading });
    expect(within(problems).getByText('Builds are flaky')).toBeInTheDocument();
    expect(problems).not.toHaveTextContent(LEADER);
    expect(namesShown()).toEqual([]);
  });

  it('Leaving the board forgets the switch', async () => {
    const user = userEvent.setup();
    await renderWithLanguage(
      <Routes>
        <Route path="/teams/:teamId" element={<BoardPage />} />
        <Route
          path="/teams/:teamId/meetings"
          element={<Link to={`/teams/${TEAM_ID}`}>To the board</Link>}
        />
      </Routes>,
      'en',
      { route: `/teams/${TEAM_ID}`, auth: { email: MEMBER } },
    );
    await screen.findByText('Builds are flaky');
    await user.click(hideNames());
    expect(namesShown()).toEqual([]);

    await user.click(screen.getByRole('link', { name: en.board.meetingsLink }));
    await user.click(screen.getByRole('link', { name: 'To the board' }));

    await screen.findByText('Builds are flaky');
    expect(hideNames()).not.toBeChecked();
    await waitFor(() => expect(namesShown()).toContain(LEADER));
  });
});
