/**
 * Opening a meeting refetches the team's meetings, so the proposal for the
 * next one - which only the server computes - follows; and setting the
 * schedule refreshes the team list exactly.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLanguage } from '../../test/render';
import { useMeetings, useOpenMeeting, useSetSchedule } from './useMeetings';
import type { MeetingList } from '../../api/meetings';

const TEAM_ID = 'team-1';

let listing: MeetingList;

function Probe() {
  const meetings = useMeetings(TEAM_ID);
  const open = useOpenMeeting(TEAM_ID);
  const schedule = useSetSchedule(TEAM_ID);
  return (
    <>
      <p>proposed: {meetings.data?.proposed?.date ?? 'none'}</p>
      <p>count: {meetings.data?.meetings.length}</p>
      <button type="button" onClick={() => open.mutate({ date: '2026-10-14', time: '13:00' })}>
        open
      </button>
      <button type="button" onClick={() => schedule.mutate({ weekday: 3, time: '13:00' })}>
        schedule
      </button>
    </>
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  listing = {
    schedule: { weekday: 3, time: '13:00' },
    proposed: { date: '2026-10-14', time: '13:00' },
    meetings: [],
  };
  fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      // What the server would now say: this Wednesday is taken.
      listing = {
        ...listing,
        proposed: { date: '2026-10-21', time: '13:00' },
        meetings: [
          {
            id: 'm-1',
            team_id: TEAM_ID,
            date: '2026-10-14',
            time: '13:00',
            starts_at: '2026-10-14T11:00:00Z',
            host: null,
          },
        ],
      };
      return Promise.resolve({ ok: true, status: 201, json: async () => ({}) } as Response);
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => listing } as Response);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function gets(path: string) {
  return (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
    ([url, init]) => url === `/api${path}` && (init?.method ?? 'GET') === 'GET',
  ).length;
}

describe('the meetings hooks', () => {
  it('refetch the list and its proposal after a meeting is opened', async () => {
    await renderWithLanguage(<Probe />, 'en');
    await screen.findByText('proposed: 2026-10-14');

    await userEvent.click(screen.getByRole('button', { name: 'open' }));

    await screen.findByText('proposed: 2026-10-21');
    expect(screen.getByText('count: 1')).toBeInTheDocument();
    expect(gets(`/teams/${TEAM_ID}/meetings`)).toBe(2);
  });

  it('refresh the meetings and the team list after the schedule is set', async () => {
    await renderWithLanguage(<Probe />, 'en');
    await screen.findByText('proposed: 2026-10-14');

    await userEvent.click(screen.getByRole('button', { name: 'schedule' }));

    await vi.waitFor(() => expect(gets(`/teams/${TEAM_ID}/meetings`)).toBe(2));
    const sent = (fetchMock.mock.calls as [string, RequestInit | undefined][]).find(
      ([, init]) => init?.method === 'PUT',
    );
    expect(sent?.[0]).toBe(`/api/teams/${TEAM_ID}/schedule`);
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ weekday: 3, time: '13:00' });
  });
});
