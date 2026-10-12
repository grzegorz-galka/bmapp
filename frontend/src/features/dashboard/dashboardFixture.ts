/**
 * A dashboard summary to render tests against.
 *
 * Dates are built relative to a fixed "now" so a test can assert on today's
 * meeting, a later one, and an overdue item without depending on the day it
 * runs. The teams, meetings and items agree with one another as the API's
 * would: Platform Core meets today, Payments' next meeting is only proposed,
 * and Infrastructure has neither a schedule nor a meeting.
 */
import type { DashboardMeeting, DashboardSummary } from '../../api/dashboard';

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

export function dashboardSummary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    current_user: { email: 'g.galka@pse.pl', initials: 'GG' },
    declarations: {
      mission: {
        headline: {
          en: 'We are here to change the energy sector for the better',
          pl: 'Jesteśmy po to, aby zmieniać energetykę na lepsze',
        },
        body: {
          en: 'Every project of ours is meant to make the energy sector safer.',
          pl: 'Każdy nasz projekt ma czynić energetykę bezpieczniejszą.',
        },
      },
      vision: {
        headline: {
          en: 'We want to create the best solutions in the industry',
          pl: 'Chcemy tworzyć najlepsze rozwiązania w branży',
        },
        body: {
          en: 'Quality is our point of reference.',
          pl: 'Punktem odniesienia jest dla nas jakość.',
        },
      },
      goals: [
        {
          en: 'Growth – PLN 174 million in revenue in 2026 with a headcount of 397',
          pl: 'Wzrost – 174 mln zł przychodu w 2026 r. przy zatrudnieniu 397 osób',
        },
        {
          en: 'Adaptability – client NPS: a first measurement with a positive score',
          pl: 'Zdolność do adaptacji – NPS klienta: pierwszy pomiar z wynikiem dodatnim',
        },
        {
          en: 'Employee satisfaction – eNPS of 35+ by 2030',
          pl: 'Satysfakcja pracowników – eNPS 35+ do 2030 r.',
        },
      ],
      values: [
        {
          name: { en: 'Effectiveness', pl: 'Skuteczność' },
          description: {
            en: 'We deliver what we committed to – on time and in full.',
            pl: 'Dowozimy to, do czego się zobowiązaliśmy – na czas i w pełnym zakresie.',
          },
          icon: 'effectiveness',
        },
        {
          name: { en: 'Passion', pl: 'Pasja' },
          description: {
            en: 'Passion drives a quality no procedure can enforce.',
            pl: 'Pasja napędza jakość, której nie da się wymusić procedurą.',
          },
          icon: 'passion',
        },
        {
          name: { en: 'Innovation', pl: 'Innowacyjność' },
          description: {
            en: 'We look for better solutions before anyone asks for them.',
            pl: 'Szukamy lepszych rozwiązań, zanim ktoś o nie poprosi.',
          },
          icon: 'innovation',
        },
        {
          name: { en: 'Collaboration', pl: 'Współdziałanie' },
          description: {
            en: 'We all play for the same goal.',
            pl: 'Gramy do jednej bramki.',
          },
          icon: 'collaboration',
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
