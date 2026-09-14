/**
 * A hub summary to render tests against.
 *
 * Dates are built relative to a fixed "now" so a test can assert on both an
 * overdue and an on-time item without depending on the day it runs.
 */
import type { HubSummary } from '../../api/hub';

/** A Thursday. */
export const NOW = new Date('2026-09-17T12:00:00Z');

const day = (offset: number): string => {
  const date = new Date(NOW);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

export function hubSummary(overrides: Partial<HubSummary> = {}): HubSummary {
  return {
    provisional: true,
    current_user: { email: 'g.galka@pse.pl', initials: 'GG' },
    declarations: {
      mission: { en: 'Keep the systems dependable.', pl: 'Utrzymywać systemy niezawodnie.' },
      vision: { en: 'Every team improving weekly.', pl: 'Każdy zespół poprawia się co tydzień.' },
      goals: [
        { en: 'No unplanned downtime.', pl: 'Żadnych nieplanowanych przestojów.' },
        { en: 'Change reaches production weekly.', pl: 'Zmiana trafia na produkcję co tydzień.' },
        { en: 'Close more than we raise.', pl: 'Zamykać więcej niż zgłaszamy.' },
      ],
      values: [
        { en: 'Go and see', pl: 'Idź i zobacz' },
        { en: 'Small steps', pl: 'Małe kroki' },
      ],
    },
    teams: [
      {
        id: 'payments',
        name: 'Payments',
        initials: 'PY',
        role: 'member',
        next_meeting_at: '2026-09-22T11:30:00Z',
        readiness: { code: 'metrics_missing', count: 3 },
      },
      {
        id: 'platform-core',
        name: 'Platform Core',
        initials: 'PC',
        role: 'leader',
        next_meeting_at: '2026-09-24T09:30:00Z',
        readiness: { code: 'ready', count: null },
      },
    ],
    preparation: { metrics_due: 7, problems_to_review: 4, open_tasks: 11 },
    meeting_in_session: true,
    funnel: {
      scope_meetings: 12,
      stages: [
        { stage: 'open', problems: 11, tasks: 7 },
        { stage: 'in_progress', problems: 4, tasks: 7 },
        { stage: 'archived', problems: 23, tasks: 41 },
      ],
    },
    assigned_items: [
      {
        id: 'item-1',
        kind: 'problem',
        summary: { en: 'Deploy pipeline flaky', pl: 'Niestabilny pipeline' },
        team: 'Platform Core',
        progress: 60,
        due_on: day(4),
      },
      {
        id: 'item-3',
        kind: 'task',
        summary: { en: 'Lead time above 5 days', pl: 'Czas realizacji powyżej 5 dni' },
        team: 'Payments',
        progress: 10,
        due_on: day(-3),
      },
    ],
    ...overrides,
  };
}
