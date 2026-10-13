/** Shared fixtures for the board's tests: one team, its meetings, and a board. */
import { vi } from 'vitest';
import type { Meeting, MeetingList } from '../../api/meetings';
import type {
  BoardMetric,
  MeetingBoard,
  Metric,
  MetricDefinition,
  MetricGroup,
  MetricTrend,
  Threshold,
} from '../../api/metrics';
import type { TeamDetail } from '../../api/teams';
import type { PulseAnswerRead, PulseRating, PulseResults, PulseStatus } from '../../api/pulse';
import type { ItemState, ProblemRead, TaskRead } from '../../api/items';

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
    { employee_id: 'emp-anna', email: LEADER, is_leader: true, is_deputy: false },
    { employee_id: 'emp-bartek', email: MEMBER, is_leader: false, is_deputy: false },
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

export const FINANCE: MetricGroup = { id: 'group-finance', name: 'Finance', position: 0 };

export function definition(overrides: Partial<MetricDefinition> = {}): MetricDefinition {
  return {
    id: 'metric-revenue',
    team_id: TEAM_ID,
    scope: 'board',
    name: 'Revenue',
    unit: '%',
    decimals: 1,
    direction: 'higher_is_better',
    group: FINANCE,
    position: 0,
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

const RATING_STATUS: Record<PulseRating, PulseStatus> = {
  5: 'green',
  4: 'green',
  3: 'amber',
  2: 'red',
  1: 'red',
};

export function pulseAnswer(
  email: string,
  rating: PulseRating,
  overrides: Partial<PulseAnswerRead> = {},
): PulseAnswerRead {
  return {
    employee_id: `emp-${email.split('@')[0] ?? email}`,
    email,
    rating,
    status: RATING_STATUS[rating],
    positive: `${email} positive`,
    negative: `${email} negative`,
    better: `${email} better`,
    updated_at: '2026-10-12T08:00:00Z',
    ...overrides,
  };
}

/** The spec's meeting: 7 answers of 11, rated 5, 4, 4, 4, 3, 3 and 2. */
export const SEVEN_ANSWERS: PulseAnswerRead[] = (
  [
    ['ala', 5],
    ['bartek', 4],
    ['celina', 4],
    ['darek', 4],
    ['ewa', 3],
    ['franek', 3],
    ['gosia', 2],
  ] as const
).map(([name, rating]) => pulseAnswer(`${name}@example.com`, rating));

export const FOUR_MISSING = ['hania', 'igor', 'jan', 'kasia'].map((name) => ({
  employee_id: `emp-${name}`,
  email: `${name}@example.com`,
}));

/** A meeting's pulse results as a member reads them: 7 of 11, averaging 3.57. */
export function pulseResults(
  meetingId = 'm-2026-10-14',
  overrides: Partial<PulseResults> = {},
): PulseResults {
  return {
    meeting_id: meetingId,
    editable: meetingId === 'm-2026-10-07' || meetingId === 'm-2026-10-14',
    answered: 7,
    members: 11,
    average: '3.57',
    status: 'amber',
    previous: { meeting_id: 'm-2026-10-07', date: '2026-10-07', average: '3.80' },
    change: '-0.23',
    distribution: { '1': 0, '2': 1, '3': 2, '4': 3, '5': 1 },
    trend: [
      {
        meeting_id: 'm-2026-10-07',
        date: '2026-10-07',
        average: '3.80',
        status: 'amber',
        answered: 10,
      },
      { meeting_id: meetingId, date: '2026-10-14', average: '3.57', status: 'amber', answered: 7 },
    ],
    answers: SEVEN_ANSWERS,
    missing: FOUR_MISSING,
    missing_count: 4,
    own: null,
    ...overrides,
  };
}

/** A meeting at which nobody has answered. */
export function noPulse(meetingId: string, overrides: Partial<PulseResults> = {}): PulseResults {
  return pulseResults(meetingId, {
    answered: 0,
    members: 2,
    average: null,
    status: 'no_data',
    previous: null,
    change: null,
    distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    trend: [],
    answers: [],
    missing: TEAM.members.map(({ employee_id, email }) => ({ employee_id, email })),
    missing_count: 2,
    ...overrides,
  });
}

/** An active problem raised at the coming meeting, with nothing optional set. */
export function problem(overrides: Partial<ProblemRead> = {}): ProblemRead {
  return {
    id: 'problem-1',
    team_id: TEAM_ID,
    summary: 'Builds are flaky',
    reason: 'Shared test database',
    solution: '',
    responsible: null,
    due_on: null,
    metric: null,
    stage: 'not_started',
    archived: false,
    overdue: false,
    raised_at: '2026-10-12T08:00:00Z',
    raised_meeting: { id: 'm-2026-10-14', date: '2026-10-14' },
    closed_at: null,
    closed_meeting: null,
    updated_at: '2026-10-12T08:00:00Z',
    ...overrides,
  };
}

/** An active task raised at the coming meeting, with nothing optional set. */
export function task(overrides: Partial<TaskRead> = {}): TaskRead {
  return {
    id: 'task-1',
    team_id: TEAM_ID,
    summary: 'Update the agenda',
    details: '',
    problem: null,
    responsible: null,
    due_on: null,
    metric: null,
    stage: 'not_started',
    archived: false,
    overdue: false,
    raised_at: '2026-10-12T08:00:00Z',
    raised_meeting: { id: 'm-2026-10-14', date: '2026-10-14' },
    closed_at: null,
    closed_meeting: null,
    updated_at: '2026-10-12T08:00:00Z',
    ...overrides,
  };
}

/** A team's problems and tasks by state, as the two list endpoints return them. */
export interface ItemFixtures {
  problems: Record<ItemState, ProblemRead[]>;
  tasks: Record<ItemState, TaskRead[]>;
}

export function noItems(): ItemFixtures {
  return { problems: { active: [], archived: [] }, tasks: { active: [], archived: [] } };
}

export function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

export function errorResponse(status: number, field: string | null, code: string) {
  return jsonResponse({ errors: [{ field, code, message: 'developer text' }] }, status);
}

export interface Fixtures {
  boards: Record<string, MeetingBoard>;
  trend: MetricTrend;
  /** Pulse results by meeting id; a meeting not listed has no answers. */
  pulse?: Record<string, PulseResults>;
  /** The team's problems and tasks; none when left out. */
  items?: ItemFixtures;
  /** The board's metrics as the settings list them; the one tile's metric when left out. */
  metrics?: Metric[];
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
    const pulseMatch = /\/meetings\/([^/]+)\/pulse$/.exec(url);
    if (pulseMatch) {
      const meetingId = decodeURIComponent(pulseMatch[1] ?? '');
      return Promise.resolve(jsonResponse(fixtures.pulse?.[meetingId] ?? noPulse(meetingId)));
    }
    const itemsMatch = /\/(problems|tasks)\?state=(active|archived)$/.exec(url);
    if (itemsMatch) {
      const kind = itemsMatch[1] as 'problems' | 'tasks';
      const state = itemsMatch[2] as ItemState;
      return Promise.resolve(jsonResponse((fixtures.items ?? noItems())[kind][state]));
    }
    if (url.endsWith('/meetings')) return Promise.resolve(jsonResponse(MEETINGS));
    if (url.endsWith('/metrics')) {
      return Promise.resolve(
        jsonResponse(fixtures.metrics ?? [{ ...definition(), threshold: null }]),
      );
    }
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
