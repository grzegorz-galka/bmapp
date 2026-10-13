/**
 * Requirement: The interface offers only what its viewer may do.
 *
 * The server refuses regardless of what is rendered; these are about not
 * offering a control the person cannot use, and about still showing them
 * everything they may read.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { TeamMembersPage } from './TeamMembersPage';
import { TeamsPage } from './TeamsPage';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import type { Member, TeamDetail } from '../../api/teams';

const TEAM_ID = 'team-1';
const LEADER_EMAIL = 'anna@example.com';
const MEMBER_EMAIL = 'bartek@example.com';
const DEPUTY_EMAIL = 'dora@example.com';
const OTHER_DEPUTY_EMAIL = 'edyta@example.com';
const STRANGER_EMAIL = 'stranger@example.com';

function member(email: string, isLeader = false, isDeputy = false): Member {
  return {
    employee_id: `emp-${email.split('@')[0]}`,
    email,
    is_leader: isLeader,
    is_deputy: isDeputy,
  };
}

const TEAM: TeamDetail = {
  id: TEAM_ID,
  name: 'Platform',
  board: { id: 'board-1', name: 'Platform', schedule: null },
  members: [
    member(LEADER_EMAIL, true),
    member(MEMBER_EMAIL),
    member(DEPUTY_EMAIL, false, true),
    member(OTHER_DEPUTY_EMAIL, false, true),
  ],
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function serveTeam(body: unknown = TEAM, status = 200) {
  fetchMock.mockResolvedValue({ ok: status < 400, status, json: async () => body } as Response);
}

async function renderMembers(auth: { email?: string | null; isAdmin?: boolean }) {
  await renderWithLanguage(
    <Routes>
      <Route path="/teams/:teamId/members" element={<TeamMembersPage />} />
      <Route path="/teams" element={<p>the team list</p>} />
    </Routes>,
    'en',
    { route: `/teams/${TEAM_ID}/members`, auth },
  );
  await screen.findByRole('heading', { name: en.members.heading.replace('{{name}}', 'Platform') });
}

/** The row control `label` names for `email`, or null when it is not offered. */
function control(label: string, email: string) {
  return screen.queryByRole('button', { name: label.replace('{{email}}', email) });
}

/** Every membership control the page offers, by what it does. */
function offered() {
  return {
    add: screen.queryByRole('button', { name: en.members.add }) !== null,
    removeMember: control(en.members.removeLabel, MEMBER_EMAIL) !== null,
    removeDeputy: control(en.members.removeLabel, OTHER_DEPUTY_EMAIL) !== null,
    handOver: control(en.members.makeLeaderLabel, MEMBER_EMAIL) !== null,
    appoint: control(en.members.makeDeputyLabel, MEMBER_EMAIL) !== null,
    revoke: control(en.members.revokeDeputyLabel, OTHER_DEPUTY_EMAIL) !== null,
  };
}

describe('The interface offers only what its viewer may do', () => {
  it('A leader sees the controls they may use', async () => {
    serveTeam();

    await renderMembers({ email: LEADER_EMAIL, isAdmin: false });

    // Membership and who stands in are the leader's; handing over is the
    // organization's.
    expect(offered()).toEqual({
      add: true,
      removeMember: true,
      removeDeputy: true,
      handOver: false,
      appoint: true,
      revoke: true,
    });
  });

  it('A deputy sees the controls they may use', async () => {
    serveTeam();

    await renderMembers({ email: DEPUTY_EMAIL, isAdmin: false });

    // Ordinary arrivals and departures, but not the circle of deputies.
    expect(offered()).toEqual({
      add: true,
      removeMember: true,
      removeDeputy: false,
      handOver: false,
      appoint: false,
      revoke: false,
    });
    // Not even themselves: a deputy who steps down asks the leader.
    expect(control(en.members.revokeDeputyLabel, DEPUTY_EMAIL)).not.toBeInTheDocument();
    expect(control(en.members.removeLabel, DEPUTY_EMAIL)).not.toBeInTheDocument();
  });

  it('An ordinary member sees no membership controls', async () => {
    serveTeam();

    await renderMembers({ email: MEMBER_EMAIL, isAdmin: false });

    expect(screen.getByText(LEADER_EMAIL)).toBeInTheDocument();
    expect(screen.getByText(DEPUTY_EMAIL)).toBeInTheDocument();
    expect(Object.values(offered()).some(Boolean)).toBe(false);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('An administrator sees every control', async () => {
    serveTeam();

    await renderMembers({ email: 'admin@pse.pl', isAdmin: true });

    expect(Object.values(offered()).every(Boolean)).toBe(true);
  });

  it('still shows a viewer who may do nothing the team and its members', async () => {
    serveTeam();

    await renderMembers({ email: STRANGER_EMAIL, isAdmin: false });

    expect(screen.getByText(LEADER_EMAIL)).toBeInTheDocument();
    expect(screen.getByText(MEMBER_EMAIL)).toBeInTheDocument();
    expect(Object.values(offered()).some(Boolean)).toBe(false);
  });

  it('does not treat the leader of another team as a leader here', async () => {
    serveTeam();

    // Leads some other team, but is a stranger here.
    await renderMembers({ email: 'other.lead@example.com', isAdmin: false });

    expect(screen.queryByRole('button', { name: en.members.add })).not.toBeInTheDocument();
  });
});

describe('the team page', () => {
  async function renderTeams(
    auth: { email?: string | null; isAdmin?: boolean },
    language: 'en' | 'pl' = 'en',
  ) {
    await renderWithLanguage(<TeamsPage />, language, { auth });
    await screen.findByRole('heading', {
      name: language === 'en' ? en.teams.heading : pl.teams.heading,
    });
  }

  it('offers registering a team only to an administrator', async () => {
    serveTeam([]);

    await renderTeams({ email: MEMBER_EMAIL, isAdmin: false });

    expect(screen.queryByRole('button', { name: en.teams.register })).not.toBeInTheDocument();
  });

  it('offers it to an administrator', async () => {
    serveTeam([]);

    await renderTeams({ email: 'admin@pse.pl', isAdmin: true });

    expect(screen.getByRole('button', { name: en.teams.register })).toBeInTheDocument();
  });

  it('still lists the registered teams for someone who may not register one', async () => {
    serveTeam([
      {
        id: TEAM_ID,
        name: 'Platform',
        board: { id: 'b', name: 'Platform', schedule: null },
        leader: { employee_id: 'e', email: LEADER_EMAIL },
        member_count: 2,
      },
    ]);

    await renderTeams({ email: MEMBER_EMAIL, isAdmin: false });

    expect(
      await screen.findByRole('link', {
        name: en.teams.membersLinkLabel.replace('{{name}}', 'Platform'),
      }),
    ).toBeInTheDocument();
  });
});
