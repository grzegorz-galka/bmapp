/**
 * The problems and tasks beside the tiles. One test per scenario of "The
 * board shows the active problems and tasks" in
 * specs/problems-and-tasks/spec.md; the overdue mark is in ItemEntry.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { BoardPage } from '../BoardPage';
import { renderWithLanguage } from '../../../test/render';
import { en } from '../../../i18n/en';
import { pl } from '../../../i18n/pl';
import type { Language } from '../../../i18n/languages';
import {
  board,
  jsonResponse,
  LEADER,
  MEETINGS,
  MEMBER,
  MONDAY,
  noItems,
  problem,
  serveBoard,
  task,
  TEAM_ID,
  TREND,
  type Fixtures,
} from '../boardFixture';

const fetchMock = vi.fn();
let fixtures: Fixtures;

const EARLIER = { id: 'm-2026-10-07', date: '2026-10-07' };
const COMING = { id: 'm-2026-10-14', date: '2026-10-14' };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MONDAY);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fixtures = {
    boards: Object.fromEntries(MEETINGS.meetings.map((m) => [m.id, board(m.date)])),
    trend: TREND,
    items: noItems(),
    write: () => jsonResponse({}),
  };
  serveBoard(fetchMock, fixtures);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function renderBoard(query = '', language: Language = 'en') {
  await renderWithLanguage(
    <Routes>
      <Route path="/teams/:teamId" element={<BoardPage />} />
    </Routes>,
    language,
    { route: `/teams/${TEAM_ID}${query}`, auth: { email: MEMBER } },
  );
  // The first render of a file loads the whole board; under a busy machine that
  // alone can pass the default second, so the first wait is given longer.
  await screen.findByRole('heading', { name: 'Revenue' }, { timeout: 5000 });
}

function listOf(heading: string) {
  return screen.getByRole('region', { name: heading });
}

async function entriesOf(heading: string) {
  return within(listOf(heading)).findAllByRole('listitem');
}

describe('the board shows the active problems and tasks', () => {
  it('The lists are shown', async () => {
    fixtures.items!.problems.active = [
      problem({
        id: 'p-1',
        summary: 'Builds are flaky',
        responsible: { employee_id: 'emp-anna', email: LEADER },
        due_on: '2026-10-20',
        stage: 'plan',
      }),
      problem({ id: 'p-2', summary: 'Too many meetings' }),
    ];
    fixtures.items!.tasks.active = [
      task({
        id: 't-1',
        summary: 'Split the test database',
        responsible: { employee_id: 'emp-bartek', email: MEMBER },
        due_on: '2026-10-15',
        stage: 'do',
      }),
      task({ id: 't-2', summary: 'Update the agenda' }),
      task({ id: 't-3', summary: 'Book the room', stage: 'check' }),
    ];
    await renderBoard();

    const lists = screen.getByRole('complementary', { name: en.items.listsLabel });
    expect(within(lists).getByText('Open: 2')).toBeInTheDocument();
    expect(within(lists).getByText('Open: 3')).toBeInTheDocument();
    const problems = await entriesOf(en.items.problemsHeading);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toHaveTextContent('Builds are flaky');
    expect(problems[0]).toHaveTextContent(LEADER);
    expect(problems[0]).toHaveTextContent('Due 20 Oct');
    expect(problems[0]).toHaveTextContent(en.pdca.plan);
    expect(problems[1]).toHaveTextContent(en.items.noResponsible);
    expect(problems[1]).toHaveTextContent(en.items.noDueDate);
    expect(problems[1]).toHaveTextContent(en.pdca.not_started);

    const tasks = await entriesOf(en.items.tasksHeading);
    // In the order the server returned them.
    expect(tasks.map((entry) => entry.querySelector('button')?.textContent)).toEqual([
      'Split the test database',
      'Update the agenda',
      'Book the room',
    ]);
    expect(tasks[0]).toHaveTextContent(MEMBER);
    expect(tasks[0]).toHaveTextContent('Due 15 Oct');
    expect(tasks[0]).toHaveTextContent(en.pdca.do);
    expect(tasks[2]).toHaveTextContent(en.pdca.check);
    // Beside the metrics, not instead of them.
    expect(screen.getByRole('heading', { name: 'Revenue' })).toBeInTheDocument();
  });

  it('New at this meeting', async () => {
    fixtures.items!.tasks.active = [
      task({ id: 't-new', summary: 'Raised now', raised_meeting: COMING }),
      task({ id: 't-old', summary: 'Raised before', raised_meeting: EARLIER }),
      task({ id: 't-none', summary: 'Raised with no meeting', raised_meeting: null }),
    ];
    await renderBoard();

    const [raisedNow, raisedBefore, raisedWithout] = await entriesOf(en.items.tasksHeading);
    expect(within(raisedNow!).getByText(en.items.new)).toBeInTheDocument();
    expect(within(raisedBefore!).queryByText(en.items.new)).not.toBeInTheDocument();
    expect(within(raisedWithout!).queryByText(en.items.new)).not.toBeInTheDocument();
  });

  it('Closed at this meeting', async () => {
    const closed = { archived: true, stage: 'act' as const, closed_at: '2026-10-12T07:00:00Z' };
    fixtures.items!.problems.archived = [
      problem({ id: 'p-closed', ...closed, closed_meeting: COMING }),
    ];
    fixtures.items!.tasks.archived = [
      task({ id: 't-closed', ...closed, closed_meeting: COMING }),
      task({ id: 't-earlier', ...closed, closed_meeting: EARLIER }),
    ];
    await renderBoard();

    expect(await screen.findByText('Closed at this meeting: 2')).toBeInTheDocument();
  });

  it('The lists do not depend on the meeting shown', async () => {
    const user = userEvent.setup();
    fixtures.items!.problems.active = [
      problem({ summary: 'Builds are flaky', raised_meeting: null }),
    ];
    fixtures.items!.tasks.active = [task({ summary: 'Update the agenda', raised_meeting: COMING })];
    await renderBoard();
    await entriesOf(en.items.tasksHeading);
    expect(screen.getByText(en.items.new)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: `← ${en.board.previousMeeting}` }));
    await screen.findByRole('heading', { name: 'Revenue' });

    const [onlyProblem] = await entriesOf(en.items.problemsHeading);
    const [onlyTask] = await entriesOf(en.items.tasksHeading);
    expect(onlyProblem).toHaveTextContent('Builds are flaky');
    expect(onlyTask).toHaveTextContent('Update the agenda');
    // The same items; only what is new to the meeting shown differs.
    expect(screen.queryByText(en.items.new)).not.toBeInTheDocument();
  });

  it('Nothing is open', async () => {
    fixtures.items!.tasks.active = [task()];
    await renderBoard('', 'pl');

    expect(
      await within(listOf(pl.items.problemsHeading)).findByText(pl.items.noProblems),
    ).toBeInTheDocument();
    expect(within(listOf(pl.items.problemsHeading)).queryByRole('list')).not.toBeInTheDocument();
    expect(await entriesOf(pl.items.tasksHeading)).toHaveLength(1);
  });
});

describe('the board’s lists can be reached from an address', () => {
  let scrolled: Element[];
  let release: () => void;

  beforeEach(() => {
    scrolled = [];
    // jsdom lays nothing out, so it has no scrollIntoView of its own.
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this);
    });
    // The lists arrive only after the board has first been drawn.
    const held = new Promise<void>((resolve) => (release = resolve));
    const served = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      /\/(problems|tasks)\?state=active$/.test(url)
        ? held.then(() => served(url, init))
        : served(url, init),
    );
    fixtures.items!.problems.active = [problem({ id: 'p-1', summary: 'Builds are flaky' })];
    fixtures.items!.tasks.active = [task({ id: 't-1', summary: 'Split the test database' })];
  });

  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it('The tasks list is brought into view', async () => {
    await renderBoard('#tasks');
    expect(scrolled).toHaveLength(0);

    release();

    await within(listOf(en.items.tasksHeading)).findByText('Split the test database');
    await waitFor(() => expect(scrolled).toHaveLength(1));
    expect(scrolled[0]).toBe(listOf(en.items.tasksHeading));
    expect(scrolled[0]).toHaveAttribute('id', 'tasks');
  });

  it('The problems list is brought into view', async () => {
    await renderBoard('#problems');
    expect(scrolled).toHaveLength(0);

    release();

    await within(listOf(en.items.problemsHeading)).findByText('Builds are flaky');
    await waitFor(() => expect(scrolled).toHaveLength(1));
    expect(scrolled[0]).toBe(listOf(en.items.problemsHeading));
    expect(scrolled[0]).toHaveAttribute('id', 'problems');
  });
});
