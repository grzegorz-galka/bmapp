/**
 * The board page. One test per scenario of "The board page" in
 * specs/metric-values/spec.md, then what each tile and the navigator show.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { BoardPage, defaultMeeting } from './BoardPage';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import type { Language } from '../../i18n/languages';
import {
  board,
  definition,
  LEADER,
  MEETINGS,
  MEMBER,
  MONDAY,
  serveBoard,
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

    const tiles = await screen.findAllByRole('listitem');
    expect(tiles[0]).toHaveTextContent(en.status.amber);
    expect(tiles[1]).toHaveTextContent(`${en.status.red}${en.status.setByHand}`);
    expect(tiles[1]).toHaveTextContent('Release slipped');
    expect(tiles[2]).toHaveTextContent(en.status.green);
  });

  it('says a board without metrics has none, and links a leader to the settings', async () => {
    // Scenario: A board without metrics.
    fixtures.boards['m-2026-10-14'] = board('2026-10-14', {
      metrics: [],
      completeness: { recorded: 0, total: 0, missing: [] },
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

    const tiles = await screen.findAllByRole('listitem');
    expect(tiles[0]).toHaveTextContent('-2.0 % since the last meeting · worse');
    expect(tiles[1]).toHaveTextContent('+0.5 % since the last meeting');
    expect(tiles[1]).not.toHaveTextContent(/better|worse/);
    expect(tiles[2]).toHaveTextContent(en.board.noChange);
  });

  it('puts the tiles under their group labels', async () => {
    fixtures.boards['m-2026-10-14'] = board('2026-10-14', {
      metrics: [
        tile(),
        tile({ metric: definition({ id: 'metric-x', name: 'Loose', group_label: null }) }),
      ],
    });
    await renderBoard();

    const finance = await screen.findByRole('region', { name: 'Finance' });
    expect(within(finance).getByRole('heading', { name: 'Revenue' })).toBeInTheDocument();
    const other = screen.getByRole('region', { name: en.board.noGroup });
    expect(within(other).getByRole('heading', { name: 'Loose' })).toBeInTheDocument();
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
