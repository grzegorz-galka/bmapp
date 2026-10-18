/**
 * "My board meetings": the rows, and where each action leads.
 * See specs/dashboard/spec.md, from "The dashboard lists the viewer's board
 * meetings" to "An action on a proposed date opens the meeting first".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLanguage } from '../../test/render';
import { AddressProbe } from '../../test/AddressProbe';
import { changeLanguage } from '../../i18n';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import type { DashboardMeeting } from '../../api/dashboard';
import controls from '../../styles/controls.module.css';
import { MeetingsTile } from './MeetingsTile';
import { DashboardPage } from './DashboardPage';
import {
  dashboardSummary,
  NEXT_WEEKS_MEETING,
  NOW,
  PROPOSED_MEETING,
  TODAYS_MEETING,
} from './dashboardFixture';

/** A class of the shared controls; a missing one must fail, not pass as undefined. */
function control(name: 'button' | 'default' | 'link'): string {
  const resolved = controls[name];
  if (!resolved) throw new Error(`controls.module.css has no .${name}`);
  return resolved;
}
const BUTTON = control('button');
const DEFAULT = control('default');
const LINK = control('link');

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.localStorage.clear();
});

/** The viewer of the fixture's summary. */
const VIEWER = dashboardSummary().current_user.email;

async function renderTile(
  meetings: DashboardMeeting[],
  language: 'en' | 'pl' = 'en',
  viewerEmail = VIEWER,
) {
  await renderWithLanguage(
    <>
      <MeetingsTile meetings={meetings} viewerEmail={viewerEmail} />
      <AddressProbe />
    </>,
    language,
  );
}

/** The rows of the tile, in order, without the facts listed inside each. */
function rows(): HTMLElement[] {
  const tile = screen.getByRole('heading', { level: 2 }).closest('section')!;
  return [...tile.querySelector('ul')!.children] as HTMLElement[];
}

/** The row of the meeting whose team and date are given. */
function rowOf(team: string, date: RegExp): HTMLElement {
  const row = rows().find(
    (node) => node.textContent?.includes(team) && date.test(node.textContent),
  );
  if (!row) throw new Error(`No row for ${team} on ${date}`);
  return row;
}

const address = () => screen.getByTestId('address');
/** The state the action navigated with: where the board was opened from. */
const navigatedState = () => JSON.parse(screen.getByTestId('location-state').textContent!);
const FROM_DASHBOARD = { from: { screen: 'dashboard', path: '/' } };

/** Meetings later than the fixture's, one week apart, as the server orders them. */
function laterMeetings(count: number): DashboardMeeting[] {
  return Array.from({ length: count }, (_, index) => ({
    ...NEXT_WEEKS_MEETING,
    meeting_id: `meeting-later-${index}`,
    date: `2026-10-${String(1 + 7 * index).padStart(2, '0')}`,
  }));
}

/** The "More…" link, found by the accessible name that says what there is more of. */
const moreLink = () => screen.queryByRole('link', { name: en.dashboard.moreMeetings });

describe('the meeting rows', () => {
  it("Today's and the next meeting are listed", async () => {
    await renderTile([TODAYS_MEETING, NEXT_WEEKS_MEETING]);

    const today = rowOf('Platform Core', /17 Sep/);
    expect(today).toHaveTextContent(en.meetingsTile.today);
    expect(today).toHaveTextContent('Host: anna.nowak@pse.pl');
    expect(today).toHaveTextContent('12 of 14 recorded');
    expect(today).toHaveTextContent(en.meetingsTile.pulseNotAnswered);

    const next = rowOf('Platform Core', /24 Sep/);
    expect(next).not.toHaveTextContent(en.meetingsTile.today);
    expect(next).toHaveTextContent(en.meetingsTile.noHost);
    expect(next).toHaveTextContent('0 of 14 recorded');
    expect(next).toHaveTextContent(en.meetingsTile.pulseAnswered);
  });

  it('A proposed date is listed as not yet opened', async () => {
    await renderTile([PROPOSED_MEETING]);

    const row = rowOf('Payments', /22 Sep/);
    expect(row).toHaveTextContent('13:30');
    expect(row).toHaveTextContent(en.meetingsTile.notOpened);
    expect(row).not.toHaveTextContent(/Host/);
    expect(row).not.toHaveTextContent(/recorded/);
    expect(row).not.toHaveTextContent(/Pulse check \d/);
    expect(row).not.toHaveTextContent(/owe/);
  });

  it('Meetings of several teams are interleaved', async () => {
    // As the server orders them: by start, whichever team holds them.
    await renderTile([TODAYS_MEETING, PROPOSED_MEETING, NEXT_WEEKS_MEETING]);

    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining('Platform Core'),
      expect.stringContaining('Payments'),
      expect.stringContaining('Platform Core'),
    ]);
  });

  it('Recording progress and the pulse check are stated in words', async () => {
    await renderTile([TODAYS_MEETING], 'pl');

    const row = rowOf('Platform Core', /17/);
    expect(row).toHaveTextContent('Wpisano 12 z 14');
    expect(row).toHaveTextContent('Pulse check 4 z 6');
    expect(row).toHaveTextContent(pl.meetingsTile.pulseNotAnswered);

    await changeLanguage('en');
    expect(row).toHaveTextContent('12 of 14 recorded');
    expect(row).toHaveTextContent('Pulse check 4 of 6');
    expect(row).toHaveTextContent(en.meetingsTile.pulseNotAnswered);
  });

  it('The people owing data are counted, not named', async () => {
    await renderTile([TODAYS_MEETING]);

    const row = rowOf('Platform Core', /17 Sep/);
    expect(row).toHaveTextContent('3 people still owe data');
    // The host is the only person the row names.
    expect(row.textContent!.match(/@/g)).toHaveLength(1);
  });

  it('counts one person owing data in the singular', async () => {
    await renderTile([{ ...TODAYS_MEETING, owing: 1 }]);
    expect(rowOf('Platform Core', /17 Sep/)).toHaveTextContent('1 person still owes data');
  });

  it('follows the Polish plural forms of people owing data', async () => {
    const owing = async (count: number) => {
      const view = await renderWithLanguage(
        <MeetingsTile meetings={[{ ...TODAYS_MEETING, owing: count }]} viewerEmail={VIEWER} />,
        'pl',
      );
      const text = view.container.textContent;
      view.unmount();
      return text;
    };

    expect(await owing(1)).toContain('1 osoba jeszcze nie przekazała danych');
    expect(await owing(3)).toContain('3 osoby jeszcze nie przekazały danych');
    expect(await owing(5)).toContain('5 osób jeszcze nie przekazało danych');
    expect(await owing(22)).toContain('22 osoby jeszcze nie przekazały danych');
    expect(await owing(12)).toContain('12 osób jeszcze nie przekazało danych');

    await changeLanguage('en');
  });

  it('Nothing is coming up', async () => {
    await renderTile([], 'pl');

    expect(screen.getByText(pl.meetingsTile.empty)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    await changeLanguage('en');
  });
});

describe('the cap of the tile', () => {
  it('At most three meetings are listed', async () => {
    await renderTile([TODAYS_MEETING, PROPOSED_MEETING, NEXT_WEEKS_MEETING, ...laterMeetings(2)]);

    // The three that start soonest, in the server's order.
    expect(rows()).toHaveLength(3);
    expect(rows()[2]).toHaveTextContent(/24 Sep/);
    expect(screen.queryByText(/1 Oct/)).not.toBeInTheDocument();

    const more = moreLink()!;
    expect(more).toHaveTextContent(en.dashboard.more);
    expect(more).toHaveClass(LINK);
    expect(more.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');

    await userEvent.click(more);
    expect(address()).toHaveTextContent(/^\/my-meetings$/);
    expect(navigatedState()).toEqual(FROM_DASHBOARD);
  });

  it('Three meetings need no link to more', async () => {
    await renderTile([TODAYS_MEETING, PROPOSED_MEETING, NEXT_WEEKS_MEETING]);

    expect(rows()).toHaveLength(3);
    expect(moreLink()).not.toBeInTheDocument();
    expect(screen.queryByText(en.dashboard.more)).not.toBeInTheDocument();
  });

  it('names the link to more in Polish when Polish is active', async () => {
    await renderTile([TODAYS_MEETING, ...laterMeetings(3)], 'pl');

    const more = screen.getByRole('link', { name: pl.dashboard.moreMeetings });
    expect(more).toHaveTextContent(pl.dashboard.more);

    await changeLanguage('en');
  });
});

describe('the look of the actions', () => {
  it("Start meeting is the row's default", async () => {
    await renderTile([TODAYS_MEETING]);
    const row = rowOf('Platform Core', /17 Sep/);

    expect(within(row).getByRole('button', { name: en.meetingsTile.start })).toHaveClass(DEFAULT);
    for (const caption of [en.meetingsTile.prepare, en.meetingsTile.fillPulse]) {
      const action = within(row).getByRole('button', { name: caption });
      expect(action).toHaveClass(BUTTON);
      expect(action).not.toHaveClass(DEFAULT);
    }
  });

  it('Actions on different pages look alike', async () => {
    // The dashboard's share of the scenario: every action on the tile is one
    // of the shared buttons, and nothing else styles it.
    await renderTile([TODAYS_MEETING, PROPOSED_MEETING, NEXT_WEEKS_MEETING]);
    // `.default` composes `.button`, so it resolves to two class names.
    const allowed = new Set([BUTTON, ...DEFAULT.split(' ')]);

    const buttons = screen.getAllByRole('button');
    // Prepare and fill on each row, start on today's, check readiness on the
    // two opened ones.
    expect(buttons).toHaveLength(9);
    for (const button of buttons) {
      const classes = [...button.classList];
      expect(classes.length).toBeGreaterThan(0);
      for (const name of classes) expect(allowed).toContain(name);
    }
  });
});

describe('Prepare data', () => {
  it('Preparing data opens the recording view', async () => {
    await renderTile([NEXT_WEEKS_MEETING]);

    await userEvent.click(screen.getByRole('button', { name: en.meetingsTile.prepare }));

    expect(address()).toHaveTextContent('/teams/platform-core?meeting=meeting-next&mode=record');
    expect(navigatedState()).toEqual(FROM_DASHBOARD);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Fill in the pulse check', () => {
  it('Filling the pulse check opens the answer form', async () => {
    await renderTile([TODAYS_MEETING]);

    await userEvent.click(screen.getByRole('button', { name: en.meetingsTile.fillPulse }));

    expect(address()).toHaveTextContent(
      '/teams/platform-core?meeting=meeting-today&view=pulse&mode=answer',
    );
    expect(navigatedState()).toEqual(FROM_DASHBOARD);
  });

  it('An answered pulse check can be changed', async () => {
    await renderTile([NEXT_WEEKS_MEETING]);
    const row = rowOf('Platform Core', /24 Sep/);

    expect(row).toHaveTextContent(en.meetingsTile.pulseAnswered);
    await userEvent.click(within(row).getByRole('button', { name: en.meetingsTile.fillPulse }));

    expect(address()).toHaveTextContent(
      '/teams/platform-core?meeting=meeting-next&view=pulse&mode=answer',
    );
  });
});

describe('Start a meeting', () => {
  it("Today's meeting can be started", async () => {
    await renderTile([TODAYS_MEETING]);

    await userEvent.click(screen.getByRole('button', { name: en.meetingsTile.start }));

    expect(address()).toHaveTextContent(/^\/teams\/platform-core\?meeting=meeting-today$/);
    expect(navigatedState()).toEqual(FROM_DASHBOARD);
    // Starting records nothing.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('A later meeting cannot be started yet', async () => {
    await renderTile([NEXT_WEEKS_MEETING]);
    const row = rowOf('Platform Core', /24 Sep/);

    expect(within(row).getByRole('button', { name: en.meetingsTile.prepare })).toBeInTheDocument();
    expect(
      within(row).getByRole('button', { name: en.meetingsTile.fillPulse }),
    ).toBeInTheDocument();
    expect(
      within(row).queryByRole('button', { name: en.meetingsTile.start }),
    ).not.toBeInTheDocument();
    // No action on a later row is marked as the default.
    for (const action of within(row).getAllByRole('button')) {
      expect(action).toHaveClass(BUTTON);
      expect(action).not.toHaveClass(DEFAULT);
    }
  });
});

describe('Check readiness from a meeting row', () => {
  it('The readiness of a coming meeting is checked', async () => {
    await renderTile([NEXT_WEEKS_MEETING]);

    await userEvent.click(screen.getByRole('button', { name: en.meetingsTile.checkReadiness }));

    expect(address()).toHaveTextContent(/^\/teams\/platform-core\?meeting=meeting-next#readiness$/);
    expect(navigatedState()).toEqual(FROM_DASHBOARD);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Every member is offered it', async () => {
    // The viewer hosts neither: one row has another host, one has none.
    await renderTile([TODAYS_MEETING, NEXT_WEEKS_MEETING]);

    for (const row of rows()) {
      const action = within(row).getByRole('button', { name: en.meetingsTile.checkReadiness });
      expect(action).toHaveClass(BUTTON);
      expect(action).not.toHaveClass(DEFAULT);
    }
  });

  it('A proposed row does not offer it', async () => {
    await renderTile([PROPOSED_MEETING]);

    expect(
      within(rowOf('Payments', /22 Sep/)).queryByRole('button', {
        name: en.meetingsTile.checkReadiness,
      }),
    ).not.toBeInTheDocument();
  });
});

describe("The viewer's own meetings to host are marked", () => {
  it('The host sees their meeting marked', async () => {
    // Compared regardless of case, as the server lower-cases emails.
    await renderTile([{ ...NEXT_WEEKS_MEETING, host: VIEWER }], 'en', VIEWER.toUpperCase());

    const row = rowOf('Platform Core', /24 Sep/);
    expect(row).toHaveTextContent(en.meetingsTile.youHost);
    expect(row).not.toHaveTextContent(VIEWER);
  });

  it("Another member's meeting is not marked", async () => {
    await renderTile([TODAYS_MEETING]);

    const row = rowOf('Platform Core', /17 Sep/);
    expect(row).toHaveTextContent('Host: anna.nowak@pse.pl');
    expect(row).not.toHaveTextContent(en.meetingsTile.youHost);
  });
});

describe('An action on a proposed date', () => {
  it('Preparing a proposed meeting opens it', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: 'meeting-opened',
        team_id: 'payments',
        date: '2026-09-22',
        time: '13:30',
        starts_at: '2026-09-22T11:30:00Z',
        host: null,
      }),
    } as Response);
    await renderTile([PROPOSED_MEETING]);

    await userEvent.click(screen.getByRole('button', { name: en.meetingsTile.prepare }));

    await waitFor(() =>
      expect(address()).toHaveTextContent('/teams/payments?meeting=meeting-opened&mode=record'),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/teams/payments/meetings');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ date: '2026-09-22', time: '13:30' });
  });

  it('Someone else opened it meanwhile', async () => {
    const opened: DashboardMeeting = {
      ...PROPOSED_MEETING,
      meeting_id: 'meeting-by-someone-else',
      host: 'ewa.lis@pse.pl',
      recorded: 0,
      total: 9,
    };
    let dashboardRequests = 0;
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({
            errors: [{ field: 'date', code: 'meeting_date.taken', message: 'taken' }],
          }),
        } as Response);
      }
      dashboardRequests += 1;
      const meetings = dashboardRequests === 1 ? [PROPOSED_MEETING] : [opened];
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => dashboardSummary({ meetings }),
      } as Response);
    });

    await renderWithLanguage(
      <>
        <DashboardPage />
        <AddressProbe />
      </>,
      'pl',
    );
    const tile = await screen.findByRole('region', { name: pl.meetingsTile.heading });

    await userEvent.click(within(tile).getByRole('button', { name: pl.meetingsTile.prepare }));

    expect(await within(tile).findByRole('alert')).toHaveTextContent(
      pl.errors['meeting_date.taken'],
    );
    // The list is refetched and shows the opened meeting where the proposal was.
    expect(await within(tile).findByText(/ewa\.lis@pse\.pl/)).toBeInTheDocument();
    expect(within(tile).queryByText(pl.meetingsTile.notOpened)).not.toBeInTheDocument();
    expect(within(tile).getByRole('alert')).toBeInTheDocument();
    // No page is left.
    expect(address()).toHaveTextContent(/^\/$/);

    await changeLanguage('en');
  });
});
