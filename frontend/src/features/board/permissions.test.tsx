/**
 * Requirement: The interface offers only what its viewer may do - on the
 * board and the metric settings. The server refuses regardless; these are
 * about not offering a control the person cannot use, while still showing
 * everything they may read.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { BoardPage } from './BoardPage';
import { MetricSettingsPage } from '../metrics/MetricSettingsPage';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import type { Metric } from '../../api/metrics';
import type { PulseResults } from '../../api/pulse';
import type { ItemFixtures } from './boardFixture';
import {
  ADMIN,
  FINANCE,
  board,
  definition,
  jsonResponse,
  LEADER,
  MEETINGS,
  MEMBER,
  MONDAY,
  noItems,
  problem,
  pulseResults,
  serveBoard,
  task,
  TEAM_ID,
  threshold,
  TREND,
} from './boardFixture';

const fetchMock = vi.fn();
const METRICS: Metric[] = [{ ...definition(), threshold: threshold() }];
let pulse: Record<string, PulseResults>;
let items: ItemFixtures;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MONDAY);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  pulse = { 'm-2026-10-14': pulseResults('m-2026-10-14') };
  items = noItems();
  serveBoard(fetchMock, {
    boards: Object.fromEntries(MEETINGS.meetings.map((m) => [m.id, board(m.date)])),
    trend: TREND,
    pulse,
    items,
    write: () => jsonResponse({}),
  });
  const served = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.endsWith('/metrics')) return Promise.resolve(jsonResponse(METRICS));
    if (url.endsWith('/metric-groups')) return Promise.resolve(jsonResponse([FINANCE]));
    return served(url, init);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function openBoard(auth: { email: string; isAdmin?: boolean }, meetingId: string) {
  await renderWithLanguage(
    <Routes>
      <Route path="/teams/:teamId" element={<BoardPage />} />
      <Route path="/teams/:teamId/metrics" element={<MetricSettingsPage />} />
    </Routes>,
    'en',
    { route: `/teams/${TEAM_ID}?meeting=${meetingId}`, auth },
  );
  await screen.findByRole('heading', { name: 'Revenue' });
}

function recordingControls() {
  return {
    record: screen.queryByRole('button', { name: en.board.record }),
    correct: screen.queryByRole('button', { name: en.board.correct }),
    list: screen.queryByRole('button', { name: en.board.list }),
  };
}

describe('the board offers only what its viewer may do', () => {
  it('lets a member record values, and shows them the settings without controls', async () => {
    // Scenario: A member records values but does not configure metrics.
    const user = userEvent.setup();
    await openBoard({ email: MEMBER }, 'm-2026-10-14');

    expect(recordingControls().record).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: en.board.settingsLink }));

    await screen.findByRole('heading', { name: 'Metrics of Platform' });
    expect(screen.getByRole('listitem')).toHaveTextContent('Green from 95.0 %, amber from 85.0 %');
    for (const name of [
      en.metrics.add,
      en.metrics.copy,
      en.metrics.include,
      /^Edit:/,
      /^Retire:/,
      /^Delete:/,
      /^Change threshold:/,
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('offers recording at a frozen meeting to an administrator only, as a correction', async () => {
    // Scenario: A frozen meeting offers recording only to an administrator.
    const user = userEvent.setup();
    await openBoard({ email: LEADER }, 'm-2026-09-30');

    expect(recordingControls()).toMatchObject({ record: null, correct: null });
    expect(recordingControls().list).toBeInTheDocument();

    cleanup();
    await openBoard({ email: ADMIN, isAdmin: true }, 'm-2026-09-30');

    expect(recordingControls().record).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: en.board.correct }));
    expect(screen.getByLabelText(en.recording.reasonLabel)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Value: Revenue' })).toBeInTheDocument();
  });

  it('offers a stranger only the list of values', async () => {
    await openBoard({ email: 'stranger@example.com' }, 'm-2026-10-14');

    expect(recordingControls()).toMatchObject({ record: null, correct: null });
    expect(recordingControls().list).toBeInTheDocument();
  });
});

/*
 * Requirement: The pulse check view offers only what its viewer may do
 * (specs/authorization). Names come from the server, which withholds them
 * from a stranger; the form is offered to members only.
 */
describe('the pulse check view offers only what its viewer may do', () => {
  async function openPulse(auth: { email: string; isAdmin?: boolean }) {
    await renderWithLanguage(
      <Routes>
        <Route path="/teams/:teamId" element={<BoardPage />} />
      </Routes>,
      'en',
      { route: `/teams/${TEAM_ID}?meeting=m-2026-10-14&view=pulse`, auth },
    );
    return screen.findByRole('region', { name: en.pulse.answeredLabel });
  }

  it('A member sees the form and the answers', async () => {
    const user = userEvent.setup();
    const answered = await openPulse({ email: MEMBER });

    expect(answered).toHaveTextContent('Missing: hania@example.com');
    expect(screen.getByRole('region', { name: en.pulse.answersHeading })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: en.pulse.yourAnswer }));
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('A stranger sees the aggregates and no form', async () => {
    pulse['m-2026-10-14'] = pulseResults('m-2026-10-14', {
      answers: null,
      missing: null,
      own: null,
    });
    const answered = await openPulse({ email: 'stranger@example.com' });

    expect(answered).toHaveTextContent('7 of 11');
    expect(answered).toHaveTextContent('Answers missing: 4');
    expect(
      within(screen.getByRole('region', { name: en.pulse.trendTitle })).getByRole('img', {
        name: en.pulse.trendLabel,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: en.pulse.answersHeading })).not.toBeInTheDocument();
    expect(screen.queryByText(/@example\.com/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en.pulse.yourAnswer })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: en.pulse.hideNames })).not.toBeInTheDocument();
  });

  it('An administrator sees the answers and no form', async () => {
    const answered = await openPulse({ email: ADMIN, isAdmin: true });

    expect(answered).toHaveTextContent('Missing: hania@example.com');
    expect(screen.getByRole('region', { name: en.pulse.answersHeading })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en.pulse.yourAnswer })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});

/*
 * Requirement: The problems and tasks offer only what their viewer may do
 * (specs/authorization). The lists are the same for everyone; the controls
 * are a member's or an administrator's, and the archive is nobody's to change.
 */
describe('the problems and tasks offer only what their viewer may do', () => {
  beforeEach(() => {
    items.problems.active = [problem({ summary: 'Builds are flaky', stage: 'plan' })];
    items.tasks.active = [task({ summary: 'Update the agenda', stage: 'do' })];
    items.tasks.archived = [
      task({ id: 'task-closed', summary: 'Book the room', stage: 'act', archived: true }),
    ];
  });

  function itemControls() {
    return [
      screen.queryByRole('button', { name: en.items.addProblem }),
      screen.queryByRole('button', { name: en.items.addTask }),
      screen.queryByRole('button', { name: 'Change: Builds are flaky' }),
      screen.queryByRole('button', { name: 'Change: Update the agenda' }),
      screen.queryByRole('button', { name: `${en.pdca.plan}: move on to ${en.pdca.do}` }),
      screen.queryByRole('button', { name: `${en.pdca.do}: move on to ${en.pdca.check}` }),
    ];
  }

  it('A member sees the controls', async () => {
    await openBoard({ email: MEMBER }, 'm-2026-10-14');
    await screen.findByText('Update the agenda');

    for (const control of itemControls()) expect(control).toBeInTheDocument();
  });

  it('A stranger sees the lists without controls', async () => {
    await openBoard({ email: 'stranger@example.com' }, 'm-2026-10-14');

    expect(await screen.findByText('Builds are flaky')).toBeInTheDocument();
    expect(screen.getByText('Update the agenda')).toBeInTheDocument();
    expect(screen.getByText(en.pdca.do)).toBeInTheDocument();
    for (const control of itemControls()) expect(control).not.toBeInTheDocument();
  });

  it('Nobody changes an archived item', async () => {
    const user = userEvent.setup();
    await openBoard({ email: ADMIN, isAdmin: true }, 'm-2026-10-14');

    await user.click(screen.getByRole('button', { name: en.archive.view }));

    const archived = await screen.findByRole('region', { name: en.archive.tasksHeading });
    expect(within(archived).getByRole('rowheader', { name: 'Book the room' })).toBeInTheDocument();
    expect(within(archived).queryByRole('button')).not.toBeInTheDocument();
    expect(within(archived).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en.items.addTask })).not.toBeInTheDocument();
  });
});
