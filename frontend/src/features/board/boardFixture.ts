/** Shared fixtures for the board's tests: one team, its meetings, and a board. */
import { vi } from 'vitest';
import type { Meeting, MeetingList } from '../../api/meetings';
import type {
  BoardMetric,
  MeetingBoard,
  MetricDefinition,
  MetricTrend,
  Threshold,
} from '../../api/metrics';
import type { TeamDetail } from '../../api/teams';

export const TEAM_ID = 'team-1';
export const LEADER = 'anna@example.com';
export const MEMBER = 'bartek@example.com';
export const ADMIN = 'admin@example.com';
/** A Monday morning: the 7th has been, the 14th is coming. */
export const MONDAY = new Date('2026-10-12T08:00:00Z');

export const TEAM: TeamDetail = {
  id: TEAM_ID,
  name: 'Platform',
  board: { id: 'board-1', name: 'Platform', schedule: { weekday: 3, time: '13:00' } },
  members: [
    { employee_id: 'emp-anna', email: LEADER, is_leader: true },
    { employee_id: 'emp-bartek', email: MEMBER, is_leader: false },
  ],
};

export function meeting(date: string): Meeting {
  return {
    id: `m-${date}`,
    team_id: TEAM_ID,
    date,
    time: '13:00',
    starts_at: `${date}T11:00:00Z`,
    host: null,
  };
}

export const MEETINGS: MeetingList = {
  schedule: { weekday: 3, time: '13:00' },
  proposed: { date: '2026-10-28', time: '13:00' },
  meetings: ['2026-09-30', '2026-10-07', '2026-10-14', '2026-10-21'].map(meeting),
};

export function definition(overrides: Partial<MetricDefinition> = {}): MetricDefinition {
  return {
    id: 'metric-revenue',
    team_id: TEAM_ID,
    scope: 'board',
    name: 'Revenue',
    unit: '%',
    decimals: 1,
    direction: 'higher_is_better',
    group_label: 'Finance',
    position: 1,
    owner: null,
    retired: false,
    retired_in_catalogue: false,
    ...overrides,
  };
}

export function threshold(overrides: Partial<Threshold> = {}): Threshold {
  return {
    id: 'th-1',
    metric_id: 'metric-revenue',
    effective_from: '2026-07-01',
    green_lo: '95',
    green_hi: null,
    amber_lo: '85',
    amber_hi: null,
    reason: 'Plan',
    recorded_by_email: LEADER,
    recorded_at: '2026-07-01T08:00:00Z',
    ...overrides,
  };
}

export function tile(overrides: Partial<BoardMetric> = {}): BoardMetric {
  return {
    metric: definition(),
    threshold: threshold(),
    value: '90',
    status: 'amber',
    set_by_hand: false,
    comment: null,
    manual_status: null,
    previous: '85',
    change: '5',
    improvement: true,
    sparkline: [
      { meeting_id: 'm-2026-10-07', date: '2026-10-07', value: '85', status: 'amber' },
      { meeting_id: 'm-2026-10-14', date: '2026-10-14', value: '90', status: 'amber' },
    ],
    ...overrides,
  };
}

export function board(date: string, overrides: Partial<MeetingBoard> = {}): MeetingBoard {
  return {
    meeting: meeting(date),
    editable: date === '2026-10-07' || date === '2026-10-14',
    completeness: { recorded: 1, total: 1, missing: [] },
    metrics: [tile()],
    ...overrides,
  };
}

export const TREND: MetricTrend = {
  metric: definition(),
  points: [
    {
      meeting_id: 'm-2026-08-26',
      date: '2026-08-26',
      value: '91',
      status: 'green',
      set_by_hand: false,
      manual_status: null,
      comment: 'Ahead of plan',
      threshold: threshold({ id: 'th-july', green_lo: '90', amber_lo: '80' }),
    },
    {
      meeting_id: 'm-2026-09-02',
      date: '2026-09-02',
      value: '91',
      status: 'amber',
      set_by_hand: false,
      manual_status: null,
      comment: null,
      threshold: threshold({ id: 'th-sep', effective_from: '2026-09-01' }),
    },
  ],
  corrections: [],
};

export function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

export function errorResponse(status: number, field: string | null, code: string) {
  return jsonResponse({ errors: [{ field, code, message: 'developer text' }] }, status);
}

export interface Fixtures {
  boards: Record<string, MeetingBoard>;
  trend: MetricTrend;
  write: (url: string, init: RequestInit) => Response;
}

/**
 * A fetch that answers every read the board makes from `fixtures`, and every
 * write with `fixtures.write`. Mutate `fixtures` in a test to change answers.
 */
export function serveBoard(fetchMock: ReturnType<typeof vi.fn>, fixtures: Fixtures) {
  fetchMock.mockImplementation((url: string, init: RequestInit = {}) => {
    if (init.method && init.method !== 'GET') return Promise.resolve(fixtures.write(url, init));
    const boardMatch = /\/meetings\/([^/]+)\/board$/.exec(url);
    if (boardMatch) {
      const found = fixtures.boards[decodeURIComponent(boardMatch[1] ?? '')];
      return Promise.resolve(
        found ? jsonResponse(found) : errorResponse(404, null, 'meeting.not_found'),
      );
    }
    if (url.endsWith('/meetings')) return Promise.resolve(jsonResponse(MEETINGS));
    if (url.endsWith('/trend')) return Promise.resolve(jsonResponse(fixtures.trend));
    if (url.endsWith('/thresholds')) {
      return Promise.resolve(
        jsonResponse([threshold({ id: 'th-sep', effective_from: '2026-09-01' }), threshold()]),
      );
    }
    return Promise.resolve(jsonResponse(TEAM));
  });
}

/** The writes the page made, as [url, init] pairs. */
export function writesOf(fetchMock: ReturnType<typeof vi.fn>): [string, RequestInit][] {
  const calls = fetchMock.mock.calls as [string, RequestInit | undefined][];
  return calls.filter(
    (call): call is [string, RequestInit] =>
      call[1]?.method !== undefined && call[1].method !== 'GET',
  );
}
