/**
 * A viewer in three teams, for the pages that list several teams at once.
 * It is Monday 12 October 2026: Platform Core met on the 7th and meets next on
 * the 14th, Payments met on the 5th and meets next on the 16th, and
 * Infrastructure has never met.
 */
import { vi } from 'vitest';
import type { Meeting, MeetingList } from '../../api/meetings';
import type { PulseResults } from '../../api/pulse';
import type { Team } from '../../api/teams';
import { pulseResults } from '../board/boardFixture';
import { dashboardSummary } from '../dashboard/dashboardFixture';

export const NOW = new Date('2026-10-12T08:00:00Z');

export function teamMeeting(teamId: string, date: string, host: string | null = null): Meeting {
  return {
    id: `${teamId}-${date}`,
    team_id: teamId,
    date,
    time: '13:00',
    starts_at: `${date}T11:00:00Z`,
    host: host ? { id: `emp-${host}`, email: host } : null,
  };
}

export const MEETINGS: Record<string, MeetingList> = {
  'platform-core': {
    schedule: { weekday: 3, time: '13:00' },
    proposed: null,
    meetings: [
      teamMeeting('platform-core', '2026-10-07', 'anna@example.com'),
      teamMeeting('platform-core', '2026-10-14'),
    ],
  },
  payments: {
    schedule: null,
    proposed: null,
    meetings: [teamMeeting('payments', '2026-10-05'), teamMeeting('payments', '2026-10-16')],
  },
  infrastructure: { schedule: null, proposed: null, meetings: [] },
};

function team(id: string, name: string): Team {
  return {
    id,
    name,
    board: { id: `board-${id}`, name, schedule: null },
    leader: { id: 'emp-anna', email: 'anna@example.com' },
    member_count: 3,
  };
}

/** Every registered team, alphabetically: two of them are not the viewer's. */
export const ALL_TEAMS: Team[] = [
  team('analytics', 'Analytics'),
  team('infrastructure', 'Infrastructure'),
  team('payments', 'Payments'),
  team('platform-core', 'Platform Core'),
  team('zeta', 'Zeta'),
];

/**
 * Answer the requests these pages make. `pulse` is keyed by meeting id; a
 * meeting without an entry does not take answers.
 */
export function serve(
  fetchMock: ReturnType<typeof vi.fn>,
  {
    summary = dashboardSummary(),
    pulse = {},
  }: { summary?: ReturnType<typeof dashboardSummary>; pulse?: Record<string, PulseResults> } = {},
) {
  fetchMock.mockImplementation((url: string) => {
    const path = new URL(String(url), 'http://localhost').pathname;
    let body: unknown = [];
    const pulseMatch = /\/teams\/[^/]+\/meetings\/([^/]+)\/pulse$/.exec(path);
    const meetingsMatch = /\/teams\/([^/]+)\/meetings$/.exec(path);
    if (path.endsWith('/dashboard')) body = summary;
    else if (pulseMatch) {
      const meetingId = decodeURIComponent(pulseMatch[1]!);
      body = pulse[meetingId] ?? pulseResults(meetingId, { editable: false });
    } else if (meetingsMatch) body = MEETINGS[decodeURIComponent(meetingsMatch[1]!)];
    else if (path.endsWith('/teams')) body = ALL_TEAMS;
    return Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);
  });
}
