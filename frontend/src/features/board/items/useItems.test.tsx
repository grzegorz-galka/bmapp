/**
 * Closing an item moves it from the active list to the archived one, so a
 * change refetches both - which only the server sorts and decides.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLanguage } from '../../../test/render';
import { useChangeTask, useTasks } from './useItems';
import type { TaskRead } from '../../../api/items';
import { jsonResponse, task, TEAM_ID } from '../boardFixture';

const PATH = `/api/teams/${TEAM_ID}/tasks`;

let active: TaskRead[];
let archived: TaskRead[];

function Probe() {
  const open = useTasks(TEAM_ID, 'active');
  const closed = useTasks(TEAM_ID, 'archived');
  const change = useChangeTask(TEAM_ID);
  return (
    <>
      <p>active: {open.data?.length ?? 'none'}</p>
      <p>archived: {closed.data?.length ?? 'none'}</p>
      <button
        type="button"
        onClick={() => change.mutate({ id: 'task-1', change: { stage: 'act' } })}
      >
        close
      </button>
    </>
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  active = [task({ stage: 'check' })];
  archived = [];
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      const closed = task({
        stage: 'act',
        archived: true,
        closed_at: '2026-10-12T09:00:00Z',
        closed_meeting: { id: 'm-2026-10-14', date: '2026-10-14' },
      });
      // What the server would now say: the task has moved to the archive.
      active = [];
      archived = [closed];
      return Promise.resolve(jsonResponse(closed));
    }
    return Promise.resolve(jsonResponse(url.endsWith('state=active') ? active : archived));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function calls(method: string, url: string) {
  return (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
    ([called, init]) => called === url && (init?.method ?? 'GET') === method,
  );
}

describe('the item hooks', () => {
  it('refetch the active and the archived list after an item is closed', async () => {
    await renderWithLanguage(<Probe />, 'en');
    await screen.findByText('active: 1');
    await screen.findByText('archived: 0');

    await userEvent.click(screen.getByRole('button', { name: 'close' }));

    await screen.findByText('active: 0');
    await screen.findByText('archived: 1');
    expect(calls('GET', `${PATH}?state=active`)).toHaveLength(2);
    expect(calls('GET', `${PATH}?state=archived`)).toHaveLength(2);
    const [sent] = calls('PATCH', `${PATH}/task-1`);
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ stage: 'act' });
  });
});
