/**
 * Requirement: The interface offers only what its viewer may do - on the
 * meetings page. The server refuses regardless; these are about not offering
 * a control the person cannot use, while still showing everything they may
 * read.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { TeamMeetingsPage } from './TeamMeetingsPage';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import type { MeetingList } from '../../api/meetings';
import type { TeamDetail } from '../../api/teams';

const TEAM_ID = 'team-1';
const LEADER_EMAIL = 'anna@example.com';
const MEMBER_EMAIL = 'bartek@example.com';
const STRANGER_EMAIL = 'stranger@example.com';

const TEAM: TeamDetail = {
  id: TEAM_ID,
  name: 'Platform',
  board: { id: 'board-1', name: 'Platform', schedule: { weekday: 3, time: '13:00' } },
  members: [
    { employee_id: 'emp-anna', email: LEADER_EMAIL, is_leader: true },
    { employee_id: 'emp-bartek', email: MEMBER_EMAIL, is_leader: false },
  ],
};

const MEETINGS: MeetingList = {
  schedule: { weekday: 3, time: '13:00' },
  proposed: { date: '2026-10-21', time: '13:00' },
  meetings: [
    {
      id: 'm-1',
      team_id: TEAM_ID,
      date: '2026-10-14',
      time: '13:00',
      starts_at: '2026-10-14T11:00:00Z',
      host: null,
    },
  ],
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => (url.endsWith('/meetings') ? MEETINGS : TEAM),
    } as Response),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderMeetings(auth: { email?: string | null; isAdmin?: boolean }) {
  await renderWithLanguage(
    <Routes>
      <Route path="/teams/:teamId/meetings" element={<TeamMeetingsPage />} />
    </Routes>,
    'en',
    { route: `/teams/${TEAM_ID}/meetings`, auth },
  );
  await screen.findByRole('heading', { name: 'Meetings of Platform' });
}

function controls() {
  return {
    // Shown as a link-styled button; the fields appear only once it is chosen.
    schedule: screen.queryByRole('button', { name: en.meetings.changeSchedule }),
    prepare: screen.queryByRole('button', { name: en.meetings.prepare }),
    change: screen.queryByRole('button', { name: /^Change: meeting on/ }),
    delete: screen.queryByRole('button', { name: /^Delete: meeting on/ }),
  };
}

describe('the meetings page', () => {
  it('An ordinary member manages meetings but not the schedule', async () => {
    await renderMeetings({ email: MEMBER_EMAIL });

    const offered = controls();
    expect(offered.prepare).toBeInTheDocument();
    expect(offered.change).toBeInTheDocument();
    expect(offered.delete).toBeInTheDocument();
    expect(offered.schedule).not.toBeInTheDocument();
    expect(screen.getByText('Wednesday, 13:00')).toBeInTheDocument();
  });

  it('A stranger sees the meetings and no controls', async () => {
    await renderMeetings({ email: STRANGER_EMAIL });

    expect(Object.values(controls()).every((control) => control === null)).toBe(true);
    expect(screen.getByText('Wednesday, 13:00')).toBeInTheDocument();
    expect(screen.getByText(/14 Oct 2026/)).toBeInTheDocument();
  });

  it('offers the team leader the schedule as well as the meetings', async () => {
    await renderMeetings({ email: LEADER_EMAIL });

    const offered = controls();
    expect(offered.schedule).toBeInTheDocument();
    expect(offered.prepare).toBeInTheDocument();
  });

  it('offers an administrator every control on any team', async () => {
    await renderMeetings({ email: 'admin@pse.pl', isAdmin: true });

    expect(Object.values(controls()).every((control) => control !== null)).toBe(true);
  });
});
