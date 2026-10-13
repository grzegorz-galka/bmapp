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
import { MeetingsTile } from './MeetingsTile';
import { DashboardPage } from './DashboardPage';
import {
  dashboardSummary,
  NEXT_WEEKS_MEETING,
  NOW,
  PROPOSED_MEETING,
  TODAYS_MEETING,
} from './dashboardFixture';

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

async function renderTile(meetings: DashboardMeeting[], language: 'en' | 'pl' = 'en') {
  await renderWithLanguage(
    <>
      <MeetingsTile meetings={meetings} />
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
    expect(row).toHaveTextContent(pl.meetingsTile.pulseNotAnswered);

    await changeLanguage('en');
  });

  it('Nothing is coming up', async () => {
    await renderTile([], 'pl');

    expect(screen.getByText(pl.meetingsTile.empty)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    await changeLanguage('en');
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
