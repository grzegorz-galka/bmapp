/**
 * Adding and changing problems and tasks from the board. One test per
 * scenario of "Problems and tasks are added and changed in a dialog" in
 * specs/problems-and-tasks/spec.md.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { BoardPage } from '../BoardPage';
import { renderWithLanguage } from '../../../test/render';
import { stubDialog } from '../../auth/dialogStub';
import { en } from '../../../i18n/en';
import { pl } from '../../../i18n/pl';
import type { Language } from '../../../i18n/languages';
import type { ProblemRead, Stage, TaskRead } from '../../../api/items';
import {
  board,
  errorResponse,
  jsonResponse,
  MEETINGS,
  MEMBER,
  MONDAY,
  noItems,
  problem,
  serveBoard,
  task,
  TEAM,
  TEAM_ID,
  TREND,
  writesOf,
  type Fixtures,
} from '../boardFixture';

const fetchMock = vi.fn();
let fixtures: Fixtures;

const COMING = { id: 'm-2026-10-14', date: '2026-10-14' };
const ITEMS = `/api/teams/${TEAM_ID}`;

/**
 * Enough of the server to see a write land: a raised item joins the active
 * list, a change replaces it, and reaching `act` moves it to the archive.
 */
function write(url: string, init: RequestInit): Response {
  const body = JSON.parse(String(init.body)) as Record<string, unknown>;
  const items = fixtures.items!;
  const kind = url.includes('/problems') ? 'problems' : 'tasks';
  const list = items[kind];
  if (init.method === 'POST') {
    const id = `${kind}-new`;
    const problemId = body.problem_id as string | undefined;
    const linked = items.problems.active.find((p) => p.id === problemId);
    const raised =
      kind === 'problems'
        ? problem({ ...(body as Partial<ProblemRead>), id })
        : task({
            id,
            summary: body.summary as string,
            problem: linked ? { id: linked.id, summary: linked.summary } : null,
          });
    list.active = [...list.active, raised] as never;
    return jsonResponse(raised, 201);
  }
  const id = decodeURIComponent(url.split('/').at(-1) ?? '');
  const current = (list.active as (ProblemRead | TaskRead)[]).find((item) => item.id === id)!;
  const changed = { ...current, ...(body as { stage?: Stage }) };
  if (changed.stage === 'act') {
    list.active = list.active.filter((item) => item.id !== id) as never;
    list.archived = [{ ...changed, archived: true, closed_meeting: COMING }] as never;
  } else {
    list.active = list.active.map((item) => (item.id === id ? changed : item)) as never;
  }
  return jsonResponse(changed);
}

beforeAll(stubDialog);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MONDAY);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fixtures = {
    boards: Object.fromEntries(MEETINGS.meetings.map((m) => [m.id, board(m.date)])),
    trend: TREND,
    items: noItems(),
    write,
  };
  serveBoard(fetchMock, fixtures);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function renderBoard(language: Language = 'en') {
  await renderWithLanguage(
    <Routes>
      <Route path="/teams/:teamId" element={<BoardPage />} />
    </Routes>,
    language,
    { route: `/teams/${TEAM_ID}`, auth: { email: MEMBER } },
  );
  // The first render of a file loads the whole board; under a busy machine that
  // alone can pass the default second, so the first wait is given longer.
  await screen.findByRole('heading', { name: 'Revenue' }, { timeout: 5000 });
  return userEvent.setup();
}

function listOf(heading: string) {
  return screen.getByRole('region', { name: heading });
}

function sent(method: string, url: string): unknown[] {
  return writesOf(fetchMock)
    .filter(([called, init]) => called === url && init.method === method)
    .map(([, init]) => JSON.parse(String(init.body)));
}

describe('problems and tasks are added and changed in a dialog', () => {
  it('A problem is added', async () => {
    const user = await renderBoard();
    await within(listOf(en.items.problemsHeading)).findByText(en.items.noProblems);

    await user.click(screen.getByRole('button', { name: en.items.addProblem }));
    const dialog = screen.getByRole('dialog', { name: en.items.newProblemHeading });
    await user.type(within(dialog).getByLabelText(en.items.summaryLabel), 'Builds are flaky');
    await user.type(within(dialog).getByLabelText(en.items.reasonLabel), 'Shared test database');
    await user.click(within(dialog).getByRole('button', { name: en.items.save }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const entries = await within(listOf(en.items.problemsHeading)).findAllByRole('listitem');
    expect(entries[0]).toHaveTextContent('Builds are flaky');
    expect(sent('POST', `${ITEMS}/problems`)).toEqual([
      {
        summary: 'Builds are flaky',
        reason: 'Shared test database',
        solution: '',
        responsible_employee_id: null,
        due_on: null,
        metric_id: null,
        stage: 'not_started',
      },
    ]);
  });

  it('A stage is moved on from the list', async () => {
    fixtures.items!.tasks.active = [task({ stage: 'do' })];
    const user = await renderBoard();

    await user.click(
      await screen.findByRole('button', { name: `${en.pdca.do}: move on to ${en.pdca.check}` }),
    );

    expect(
      await screen.findByRole('button', { name: `${en.pdca.check}: move on to ${en.pdca.act}` }),
    ).toBeInTheDocument();
    expect(sent('PATCH', `${ITEMS}/tasks/task-1`)).toEqual([{ stage: 'check' }]);
  });

  it('Closing is confirmed', async () => {
    fixtures.items!.tasks.active = [task({ stage: 'check', summary: 'Book the room' })];
    fixtures.items!.problems.active = [problem({ stage: 'do', summary: 'Builds are flaky' })];
    const user = await renderBoard();

    // From the list: the ball's last step asks first, and backing out sends nothing.
    const ball = `${en.pdca.check}: move on to ${en.pdca.act}`;
    await user.click(await screen.findByRole('button', { name: ball }));
    let confirm = screen.getByRole('dialog', { name: en.items.confirmCloseHeading });
    expect(confirm).toHaveTextContent('“Book the room” will be closed');
    await user.click(within(confirm).getByRole('button', { name: en.items.confirmBack }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writesOf(fetchMock)).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: ball }));
    confirm = screen.getByRole('dialog', { name: en.items.confirmCloseHeading });
    await user.click(within(confirm).getByRole('button', { name: en.items.confirmClose }));

    expect(
      await within(listOf(en.items.tasksHeading)).findByText(en.items.noTasks),
    ).toBeInTheDocument();
    expect(sent('PATCH', `${ITEMS}/tasks/task-1`)).toEqual([{ stage: 'act' }]);

    // In the dialog: choosing the last stage asks before saving.
    await user.click(screen.getByRole('button', { name: 'Change: Builds are flaky' }));
    const dialog = screen.getByRole('dialog', { name: en.items.editProblemHeading });
    await user.selectOptions(within(dialog).getByLabelText(en.items.stageLabel), 'act');
    await user.click(within(dialog).getByRole('button', { name: en.items.save }));
    confirm = screen.getByRole('dialog', { name: en.items.confirmCloseHeading });
    expect(sent('PATCH', `${ITEMS}/problems/problem-1`)).toEqual([]);
    await user.click(within(confirm).getByRole('button', { name: en.items.confirmClose }));

    expect(
      await within(listOf(en.items.problemsHeading)).findByText(en.items.noProblems),
    ).toBeInTheDocument();
    expect(sent('PATCH', `${ITEMS}/problems/problem-1`)).toEqual([{ stage: 'act' }]);
  });

  it('A task is raised from a problem', async () => {
    fixtures.items!.problems.active = [problem({ summary: 'Builds are flaky' })];
    const user = await renderBoard();

    await user.click(await screen.findByRole('button', { name: 'Change: Builds are flaky' }));
    await user.click(screen.getByRole('button', { name: en.items.taskFromProblem }));
    const dialog = screen.getByRole('dialog', { name: en.items.newTaskHeading });
    expect(within(dialog).getByLabelText(en.items.problemLabel)).toHaveValue('problem-1');
    await user.type(within(dialog).getByLabelText(en.items.summaryLabel), 'Split the database');
    await user.click(within(dialog).getByRole('button', { name: en.items.save }));

    const [entry] = await within(listOf(en.items.tasksHeading)).findAllByRole('listitem');
    expect(entry).toHaveTextContent('Split the database');
    expect(entry).toHaveTextContent('From problem: Builds are flaky');
    expect(sent('POST', `${ITEMS}/tasks`)).toEqual([
      expect.objectContaining({ summary: 'Split the database', problem_id: 'problem-1' }),
    ]);
  });

  it('A rejection is shown in the active language', async () => {
    fixtures.items!.tasks.active = [task({ summary: 'Update the agenda' })];
    fixtures.write = () =>
      errorResponse(409, 'responsible_employee_id', 'item_responsible.not_member');
    const user = await renderBoard('pl');

    await user.click(await screen.findByRole('button', { name: 'Zmień: Update the agenda' }));
    const dialog = screen.getByRole('dialog', { name: pl.items.editTaskHeading });
    await user.selectOptions(
      within(dialog).getByLabelText(pl.items.responsibleLabel),
      TEAM.members[1]!.employee_id,
    );
    await user.click(within(dialog).getByRole('button', { name: pl.items.save }));

    const responsible = within(dialog).getByLabelText(pl.items.responsibleLabel);
    await waitFor(() => expect(responsible).toHaveAttribute('aria-invalid', 'true'));
    expect(within(dialog).getByText(pl.errors['item_responsible.not_member'])).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: pl.items.editTaskHeading })).toBeInTheDocument();
    // Only what changed was sent.
    expect(sent('PATCH', `${ITEMS}/tasks/task-1`)).toEqual([
      { responsible_employee_id: 'emp-bartek' },
    ]);
  });
});

describe('the dialog and the confirmation, beyond the scenarios', () => {
  it('offers the board’s metrics to a team that has opened no meeting', async () => {
    const served = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      url.endsWith('/meetings')
        ? Promise.resolve(jsonResponse({ ...MEETINGS, meetings: [] }))
        : served(url, init),
    );
    await renderWithLanguage(
      <Routes>
        <Route path="/teams/:teamId" element={<BoardPage />} />
      </Routes>,
      'en',
      { route: `/teams/${TEAM_ID}`, auth: { email: MEMBER } },
    );
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole('button', { name: en.items.addProblem }, { timeout: 5000 }),
    );
    const dialog = screen.getByRole('dialog', { name: en.items.newProblemHeading });
    const metric = within(dialog).getByLabelText(en.items.metricLabel);
    expect(await within(metric).findByRole('option', { name: 'Revenue' })).toBeInTheDocument();
  });

  it('opens the confirmation without an earlier step’s failure', async () => {
    fixtures.items!.tasks.active = [
      task({ id: 'task-a', stage: 'plan', summary: 'Book the room' }),
      task({ id: 'task-b', stage: 'check', summary: 'Send the minutes' }),
    ];
    fixtures.write = (url, init) =>
      url.endsWith('/task-a') ? errorResponse(409, null, 'task.archived') : write(url, init);
    const user = await renderBoard();

    await user.click(
      await screen.findByRole('button', { name: `${en.pdca.plan}: move on to ${en.pdca.do}` }),
    );
    expect(await screen.findByText(en.errors['task.archived'])).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: `${en.pdca.check}: move on to ${en.pdca.act}` }),
    );
    const confirm = screen.getByRole('dialog', { name: en.items.confirmCloseHeading });
    expect(within(confirm).queryByText(en.errors['task.archived'])).not.toBeInTheDocument();
  });
});
