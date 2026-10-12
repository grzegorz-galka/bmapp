/**
 * The board's Archived view. One test per scenario of "The Archived view" in
 * specs/problems-and-tasks/spec.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
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

const closed = { stage: 'act' as const, archived: true };

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

function Address() {
  const location = useLocation();
  return <output data-testid="address">{location.search}</output>;
}

async function renderBoard(query = '', language: Language = 'en') {
  await renderWithLanguage(
    <Routes>
      <Route
        path="/teams/:teamId"
        element={
          <>
            <BoardPage />
            <Address />
          </>
        }
      />
    </Routes>,
    language,
    { route: `/teams/${TEAM_ID}${query}`, auth: { email: MEMBER } },
  );
  const catalogue = language === 'en' ? en : pl;
  // The first render of a file loads the whole board; under a busy machine that
  // alone can pass the default second, so the first wait is given longer.
  await screen.findByRole(
    'heading',
    { name: catalogue.board.heading.replace('{{name}}', 'Platform') },
    { timeout: 5000 },
  );
  return userEvent.setup();
}

function address(): URLSearchParams {
  return new URLSearchParams(screen.getByTestId('address').textContent ?? '');
}

describe('the Archived view', () => {
  it('The archived items are listed', async () => {
    fixtures.items!.problems.archived = [
      problem({
        ...closed,
        id: 'p-late',
        summary: 'Closed last',
        responsible: { employee_id: 'emp-anna', email: LEADER },
        due_on: '2026-10-09',
        raised_meeting: { id: 'm-2026-09-30', date: '2026-09-30' },
        closed_at: '2026-10-12T07:00:00Z',
        closed_meeting: { id: 'm-2026-10-14', date: '2026-10-14' },
      }),
      problem({
        ...closed,
        id: 'p-early',
        summary: 'Closed first',
        raised_meeting: null,
        raised_at: '2026-09-01T07:00:00Z',
        closed_at: '2026-10-01T07:00:00Z',
        closed_meeting: null,
      }),
    ];
    fixtures.items!.tasks.archived = [
      task({
        ...closed,
        summary: 'A closed task',
        raised_meeting: { id: 'm-2026-10-07', date: '2026-10-07' },
        closed_at: '2026-10-08T07:00:00Z',
        closed_meeting: { id: 'm-2026-10-07', date: '2026-10-07' },
      }),
    ];
    const user = await renderBoard();

    await user.click(screen.getByRole('button', { name: en.archive.view }));

    const problems = await screen.findByRole('region', { name: en.archive.problemsHeading });
    const rows = within(problems).getAllByRole('row').slice(1);
    // In the order the server returned them: the most recently closed first.
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual([
      'Closed last',
      'Closed first',
    ]);
    expect(rows[0]).toHaveTextContent(LEADER);
    expect(rows[0]).toHaveTextContent('9 Oct');
    expect(rows[0]).toHaveTextContent('Wed, 30 Sept 2026');
    expect(rows[0]).toHaveTextContent('Wed, 14 Oct 2026');
    // With no meeting recorded, the day itself.
    expect(rows[1]).toHaveTextContent('1 Sept (no meeting)');
    expect(rows[1]).toHaveTextContent(en.items.noResponsible);
    const tasks = screen.getByRole('region', { name: en.archive.tasksHeading });
    expect(within(tasks).getAllByRole('row')[1]).toHaveTextContent('A closed task');
    expect(within(tasks).getAllByRole('row')[1]).toHaveTextContent('Wed, 7 Oct 2026');
    // Read-only: nothing to change and no active lists.
    expect(within(problems).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('The view has its own address', async () => {
    fixtures.items!.tasks.archived = [task({ ...closed, summary: 'A closed task' })];
    const user = await renderBoard('?meeting=m-2026-10-07');
    await user.click(screen.getByRole('button', { name: en.archive.view }));

    expect(address().get('view')).toBe('archived');
    expect(address().get('meeting')).toBe('m-2026-10-07');

    // Reloading the address lands on the same view.
    const reloaded = `?${address().toString()}`;
    cleanup();
    await renderBoard(reloaded);

    expect(await screen.findByRole('rowheader', { name: 'A closed task' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.archive.view })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('heading', { name: 'Revenue' })).not.toBeInTheDocument();
  });

  it('Nothing has been archived', async () => {
    await renderBoard('?view=archived', 'pl');

    expect(await screen.findByText(pl.archive.empty)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('is offered to a team that has no meetings yet', async () => {
    fixtures.items!.tasks.archived = [task({ ...closed, summary: 'Closed with no meeting' })];
    const served = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      url.endsWith('/meetings')
        ? Promise.resolve(jsonResponse({ ...MEETINGS, meetings: [] }))
        : served(url, init),
    );
    const user = await renderBoard();
    expect(screen.getByText(en.board.noMeetings)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: en.archive.view }));

    expect(address().get('view')).toBe('archived');
    expect(
      await screen.findByRole('rowheader', { name: 'Closed with no meeting' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(en.board.noMeetings)).not.toBeInTheDocument();
  });
});
