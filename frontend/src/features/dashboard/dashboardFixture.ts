/**
 * A dashboard summary to render tests against.
 *
 * Dates are built relative to a fixed "now" so a test can assert on today's
 * meeting, a later one, and an overdue item without depending on the day it
 * runs. The teams, meetings and items agree with one another as the API's
 * would: Platform Core meets today, Payments' next meeting is only proposed,
 * and Infrastructure has neither a schedule nor a meeting.
 */
import type { DashboardMeeting, DashboardSummary, DashboardTeam } from '../../api/dashboard';

/** A Thursday, 14:00 in Warsaw. */
export const NOW = new Date('2026-09-17T12:00:00Z');

const day = (offset: number): string => {
  const date = new Date(NOW);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

/** Today's meeting of Platform Core, opened, part recorded, pulse check not answered. */
export const TODAYS_MEETING: DashboardMeeting = {
  team_id: 'platform-core',
  team: 'Platform Core',
  meeting_id: 'meeting-today',
  date: '2026-09-17',
  start_time: '15:30',
  starts_at: '2026-09-17T13:30:00Z',
  today: true,
  host: 'anna.nowak@pse.pl',
  recorded: 12,
  total: 14,
  pulse_answered: false,
};

/** Payments' next Tuesday, proposed by its schedule and not yet opened. */
export const PROPOSED_MEETING: DashboardMeeting = {
  team_id: 'payments',
  team: 'Payments',
  meeting_id: null,
  date: '2026-09-22',
  start_time: '13:30',
  starts_at: '2026-09-22T11:30:00Z',
  today: false,
  host: null,
  recorded: null,
  total: null,
  pulse_answered: false,
};

/** Platform Core's meeting next week, opened ahead and already answered. */
export const NEXT_WEEKS_MEETING: DashboardMeeting = {
  team_id: 'platform-core',
  team: 'Platform Core',
  meeting_id: 'meeting-next',
  date: '2026-09-24',
  start_time: '15:30',
  starts_at: '2026-09-24T13:30:00Z',
  today: false,
  host: null,
  recorded: 0,
  total: 14,
  pulse_answered: true,
};

/**
 * Two more teams, both meeting after Payments, for a viewer on more teams than
 * the My teams tile lists. Placed in the summary's teams before
 * Infrastructure, which has no meeting, they keep the server's order.
 */
export const LATER_TEAMS: DashboardTeam[] = [
  {
    id: 'data-platform',
    name: 'Data Platform',
    initials: 'DP',
    role: 'deputy',
    schedule: { weekday: 2, start_time: '10:00' },
    next_meeting_at: '2026-09-29T08:00:00Z',
  },
  {
    id: 'security',
    name: 'Security',
    initials: 'SE',
    role: 'member',
    schedule: { weekday: 4, start_time: '09:00' },
    next_meeting_at: '2026-10-01T07:00:00Z',
  },
];

export function dashboardSummary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    current_user: { email: 'g.galka@pse.pl', initials: 'GG' },
    declarations: {
      mission: {
        en: 'We are here to change the energy sector for the better',
        pl: 'Jesteśmy po to, aby zmieniać energetykę na lepsze',
      },
      vision: {
        en: 'We want to create the best solutions in the industry',
        pl: 'Chcemy tworzyć najlepsze rozwiązania w branży',
      },
      values: [
        { name: { en: 'Effectiveness', pl: 'Skuteczność' }, icon: 'effectiveness' },
        { name: { en: 'Passion', pl: 'Pasja' }, icon: 'passion' },
        { name: { en: 'Innovation', pl: 'Innowacyjność' }, icon: 'innovation' },
        { name: { en: 'Collaboration', pl: 'Współdziałanie' }, icon: 'collaboration' },
      ],
      strategy: {
        horizon: { en: 'By 2030', pl: 'Do 2030 roku' },
        statements: [
          {
            en: 'PSE Innowacje will become the company creating the best solutions.',
            pl: 'PSE Innowacje stanie się firmą tworzącą najlepsze rozwiązania.',
          },
          {
            en: 'We will achieve this by being the most effective at delivering.',
            pl: 'Osiągniemy to poprzez bycie najbardziej skutecznymi w dowożeniu.',
          },
        ],
      },
      goals: [
        {
          horizon: { en: 'In 2026', pl: 'W 2026 roku' },
          items: [
            {
              en: 'Growth: PLN 174 million in revenue with a headcount of 397',
              pl: 'Wzrost: 174 mln zł przychodu przy zatrudnieniu 397 osób',
            },
            {
              en: 'Customer satisfaction: a first NPS measurement with a positive score',
              pl: 'Satysfakcja klienta: pierwszy pomiar NPS z wynikiem dodatnim',
            },
          ],
        },
        {
          horizon: { en: 'By 2030', pl: 'Do 2030 roku' },
          items: [
            { en: 'Employee satisfaction: eNPS 35+', pl: 'Satysfakcja pracowników: eNPS 35+' },
            { en: 'Customer satisfaction: NPS 50+', pl: 'Satysfakcja klienta: NPS 50+' },
          ],
        },
      ],
    },
    teams: [
      {
        id: 'platform-core',
        name: 'Platform Core',
        initials: 'PC',
        role: 'leader',
        schedule: { weekday: 4, start_time: '15:30' },
        next_meeting_at: '2026-09-17T13:30:00Z',
      },
      {
        id: 'payments',
        name: 'Payments',
        initials: 'PY',
        role: 'member',
        schedule: { weekday: 2, start_time: '13:30' },
        next_meeting_at: '2026-09-22T11:30:00Z',
      },
      {
        id: 'infrastructure',
        name: 'Infrastructure',
        initials: 'IN',
        role: 'member',
        schedule: null,
        next_meeting_at: null,
      },
    ],
    meetings: [TODAYS_MEETING, PROPOSED_MEETING, NEXT_WEEKS_MEETING],
    funnel: {
      scope_teams: 3,
      stages: [
        { stage: 'open', problems: 11, tasks: 7 },
        { stage: 'in_progress', problems: 4, tasks: 7 },
        { stage: 'archived', problems: 23, tasks: 41 },
      ],
    },
    assigned_items: [
      {
        id: 'item-3',
        kind: 'task',
        // Typed in Polish, and shown so in either language.
        summary: 'Skrócić czas realizacji poniżej 5 dni',
        team_id: 'payments',
        team: 'Payments',
        stage: 'plan',
        due_on: day(-3),
        overdue: true,
        metric: { id: 'metric-1', name: 'Lead time' },
        problem: { id: 'problem-9', summary: 'Releases wait for approval' },
      },
      {
        id: 'item-1',
        kind: 'problem',
        summary: 'Deploy pipeline flaky',
        team_id: 'platform-core',
        team: 'Platform Core',
        stage: 'do',
        due_on: day(4),
        overdue: false,
        metric: null,
        problem: null,
      },
      {
        id: 'item-4',
        kind: 'problem',
        summary: 'Runbook missing',
        team_id: 'payments',
        team: 'Payments',
        stage: 'not_started',
        due_on: null,
        overdue: false,
        metric: null,
        problem: null,
      },
    ],
    ...overrides,
  };
}
