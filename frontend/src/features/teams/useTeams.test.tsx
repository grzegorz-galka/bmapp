/**
 * The membership mutations write their response into the team's cache rather
 * than refetching it, and refresh the team list exactly, not by prefix.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLanguage } from '../../test/render';
import { useAddMember, useAppointDeputy, useRevokeDeputy, useTeam, useTeams } from './useTeams';
import type { Member, Team, TeamDetail } from '../../api/teams';

const TEAM_ID = 'team-1';

function detail(...members: Member[]): TeamDetail {
  return {
    id: TEAM_ID,
    name: 'Platform',
    board: { id: 'board-1', name: 'Platform', schedule: null },
    members,
  };
}

const anna: Member = {
  employee_id: 'emp-anna',
  email: 'anna@example.com',
  is_leader: true,
  is_deputy: false,
};
const bartek: Member = {
  employee_id: 'emp-bartek',
  email: 'bartek@example.com',
  is_leader: false,
  is_deputy: false,
};

function listed(memberCount: number): Team[] {
  return [
    {
      id: TEAM_ID,
      name: 'Platform',
      board: { id: 'board-1', name: 'Platform', schedule: null },
      leader: { id: anna.employee_id, email: anna.email },
      member_count: memberCount,
    },
  ];
}

function Probe() {
  const team = useTeam(TEAM_ID);
  const teams = useTeams();
  const addMember = useAddMember(TEAM_ID);
  return (
    <>
      <p>members: {team.data?.members.map((member) => member.email).join(', ')}</p>
      <p>count: {teams.data?.[0]?.member_count}</p>
      <button type="button" onClick={() => addMember.mutate('bartek@example.com')}>
        add
      </button>
    </>
  );
}

const fetchMock = vi.fn();
let listCount = 1;

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  listCount = 1;
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const body =
      init?.method === 'POST'
        ? detail(anna, bartek)
        : url.endsWith(`/teams/${TEAM_ID}`)
          ? detail(anna)
          : listed(listCount);
    return Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function gets(path: string) {
  return (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
    ([url, init]) => url === `/api${path}` && (init?.method ?? 'GET') === 'GET',
  ).length;
}

describe('a membership mutation', () => {
  it('replaces the cached team with its response, without a second fetch of the team', async () => {
    await renderWithLanguage(<Probe />, 'en');
    await screen.findByText('members: anna@example.com');
    await screen.findByText('count: 1');

    listCount = 2;
    await userEvent.click(screen.getByRole('button', { name: 'add' }));

    expect(
      await screen.findByText('members: anna@example.com, bartek@example.com'),
    ).toBeInTheDocument();
    // The list is refreshed, so its member count follows...
    expect(await screen.findByText('count: 2')).toBeInTheDocument();
    // ...but the team itself came from the mutation's response, not a refetch.
    expect(gets(`/teams/${TEAM_ID}`)).toBe(1);
    expect(gets('/teams')).toBe(2);
  });
});

function DeputyProbe() {
  const team = useTeam(TEAM_ID);
  const appoint = useAppointDeputy(TEAM_ID);
  const revoke = useRevokeDeputy(TEAM_ID);
  const deputies = team.data?.members.filter((member) => member.is_deputy) ?? [];
  return (
    <>
      <p>
        deputies: {team.data ? deputies.map((member) => member.email).join(', ') || 'none' : ''}
      </p>
      <button type="button" onClick={() => appoint.mutate(bartek.employee_id)}>
        appoint
      </button>
      <button type="button" onClick={() => revoke.mutate(bartek.employee_id)}>
        revoke
      </button>
    </>
  );
}

function requests(method: string) {
  return (fetchMock.mock.calls as [string, RequestInit | undefined][])
    .filter(([, init]) => (init?.method ?? 'GET') === method)
    .map(([url, init]) => ({ url, body: init?.body }));
}

describe('a deputy mutation', () => {
  const deputy: Member = { ...bartek, is_deputy: true };

  beforeEach(() => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body =
        method === 'PUT'
          ? detail(anna, deputy)
          : method === 'DELETE'
            ? detail(anna, bartek)
            : url.endsWith(`/teams/${TEAM_ID}`)
              ? detail(anna, bartek)
              : listed(2);
      return Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);
    });
  });

  it('appoints a deputy by PUT and stores the team it answers with', async () => {
    await renderWithLanguage(<DeputyProbe />, 'en');
    await screen.findByText('deputies: none');

    await userEvent.click(screen.getByRole('button', { name: 'appoint' }));

    expect(await screen.findByText('deputies: bartek@example.com')).toBeInTheDocument();
    expect(requests('PUT')).toEqual([
      { url: `/api/teams/${TEAM_ID}/deputies/${bartek.employee_id}`, body: undefined },
    ]);
    expect(gets(`/teams/${TEAM_ID}`)).toBe(1);
  });

  it('revokes a deputy by DELETE and stores the team it answers with', async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = method === 'DELETE' ? detail(anna, bartek) : detail(anna, deputy);
      return Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);
    });
    await renderWithLanguage(<DeputyProbe />, 'en');
    await screen.findByText('deputies: bartek@example.com');

    await userEvent.click(screen.getByRole('button', { name: 'revoke' }));

    expect(await screen.findByText('deputies: none')).toBeInTheDocument();
    expect(requests('DELETE')).toEqual([
      { url: `/api/teams/${TEAM_ID}/deputies/${bartek.employee_id}`, body: undefined },
    ]);
    expect(gets(`/teams/${TEAM_ID}`)).toBe(1);
  });
});
