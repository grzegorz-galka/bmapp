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
const STRANGER_EMAIL = 'stranger@example.com';

function member(email: string, isLeader = false): Member {
  return { employee_id: `emp-${email.split('@')[0]}`, email, is_leader: isLeader };
}

const TEAM: TeamDetail = {
  id: TEAM_ID,
  name: 'Platform',
  board: { id: 'board-1', name: 'Platform' },
  members: [member(LEADER_EMAIL, true), member(MEMBER_EMAIL)],
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

describe('the members page', () => {
  it('offers a leader the controls they may use, and not the one they may not', async () => {
    serveTeam();

    await renderMembers({ email: LEADER_EMAIL, isAdmin: false });

    // Adding and removing ordinary members is the leader's.
    expect(screen.getByRole('button', { name: en.members.add })).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: en.members.removeLabel.replace('{{email}}', MEMBER_EMAIL),
      }),
    ).toBeInTheDocument();
    // Handing over leadership is the organization's.
    expect(
      screen.queryByRole('button', {
        name: en.members.makeLeaderLabel.replace('{{email}}', MEMBER_EMAIL),
      }),
    ).not.toBeInTheDocument();
  });

  it('offers an ordinary member no membership control at all', async () => {
    serveTeam();

    await renderMembers({ email: MEMBER_EMAIL, isAdmin: false });

    expect(screen.queryByRole('button', { name: en.members.add })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: en.members.removeLabel.replace('{{email}}', MEMBER_EMAIL),
      }),
    ).not.toBeInTheDocument();
  });

  it('still shows a viewer who may do nothing the team and its members', async () => {
    serveTeam();

    await renderMembers({ email: STRANGER_EMAIL, isAdmin: false });

    expect(screen.getByText(LEADER_EMAIL)).toBeInTheDocument();
    expect(screen.getByText(MEMBER_EMAIL)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en.members.add })).not.toBeInTheDocument();
  });

  it('offers an administrator every control', async () => {
    serveTeam();

    await renderMembers({ email: 'admin@pse.pl', isAdmin: true });

    expect(screen.getByRole('button', { name: en.members.add })).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: en.members.removeLabel.replace('{{email}}', MEMBER_EMAIL),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: en.members.makeLeaderLabel.replace('{{email}}', MEMBER_EMAIL),
      }),
    ).toBeInTheDocument();
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
        board: { id: 'b', name: 'Platform' },
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
