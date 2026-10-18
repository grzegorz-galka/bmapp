/**
 * The meetings page. One test per scenario of "Meetings are managed from the
 * meetings page" in specs/meetings/spec.md, then the row actions it offers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { TeamMeetingsPage } from './TeamMeetingsPage';
import { BackLink } from '../../components/BackLink';
import { AddressProbe } from '../../test/AddressProbe';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import type { Language } from '../../i18n/languages';
import type { Meeting, MeetingList } from '../../api/meetings';
import type { Member, TeamDetail } from '../../api/teams';
import controls from '../../styles/controls.module.css';

const TEAM_ID = 'team-1';
// A Monday morning: the 7th has been, the 14th is coming.
const NOW = Date.parse('2026-10-12T08:00:00Z');
const ANNA: Member = {
  employee_id: 'emp-anna',
  email: 'anna@example.com',
  is_leader: true,
  is_deputy: false,
};
const BARTEK: Member = {
  employee_id: 'emp-bartek',
  email: 'bartek@example.com',
  is_leader: false,
  is_deputy: false,
};

const TEAM: TeamDetail = {
  id: TEAM_ID,
  name: 'Platform',
  board: { id: 'board-1', name: 'Platform', schedule: { weekday: 3, time: '13:00' } },
  members: [ANNA, BARTEK],
};

function meeting(date: string, startsAt: string, host: Member | null = null): Meeting {
  return {
    id: `m-${date}`,
    team_id: TEAM_ID,
    date,
    time: '13:00',
    starts_at: startsAt,
    host: host ? { id: host.employee_id, email: host.email } : null,
  };
}

const SEP_30 = meeting('2026-09-30', '2026-09-30T11:00:00Z');
const OCT_07 = meeting('2026-10-07', '2026-10-07T11:00:00Z', BARTEK);
const OCT_14 = meeting('2026-10-14', '2026-10-14T11:00:00Z');
const OCT_21 = meeting('2026-10-21', '2026-10-21T11:00:00Z');

function listing(overrides: Partial<MeetingList> = {}): MeetingList {
  return {
    schedule: { weekday: 3, time: '13:00' },
    proposed: { date: '2026-10-28', time: '13:00' },
    meetings: [SEP_30, OCT_07, OCT_14, OCT_21],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function errorResponse(status: number, field: string | null, code: string) {
  return jsonResponse(
    { errors: [{ field, code, message: 'English text for a developer' }] },
    status,
  );
}

const fetchMock = vi.fn();

/** GETs answer with the team and its meetings; each mutation with what the test queued. */
function serve(meetings: MeetingList = listing(), mutations: Record<string, Response> = {}) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (method !== 'GET') return Promise.resolve(mutations[method] ?? jsonResponse({}));
    return Promise.resolve(jsonResponse(url.endsWith('/meetings') ? meetings : TEAM));
  });
}

function sent(method: string): { url: string; body: unknown }[] {
  return (fetchMock.mock.calls as [string, RequestInit | undefined][])
    .filter(([, init]) => (init?.method ?? 'GET') === method)
    .map(([url, init]) => ({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined }));
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function renderPage(
  language: Language = 'en',
  auth: { email?: string | null; isAdmin?: boolean } = { isAdmin: true },
) {
  await renderWithLanguage(
    <Routes>
      <Route path="/teams/:teamId/meetings" element={<TeamMeetingsPage />} />
      <Route path="/teams" element={<p>the team list</p>} />
    </Routes>,
    language,
    { route: `/teams/${TEAM_ID}/meetings`, auth },
  );
  const catalogue = language === 'en' ? en : pl;
  await screen.findByRole('heading', {
    name: catalogue.meetings.heading.replace('{{name}}', 'Platform'),
  });
}

/** The control that plans the next meeting, captioned with the fixture's proposal. */
function planControl(catalogue: typeof en | typeof pl = en) {
  const [date, time] =
    catalogue === en ? ['Wed, 28 Oct 2026', '13:00'] : ['śr., 28 paź 2026', '13:00'];
  return screen.getByRole('button', {
    name: catalogue.meetings.prepareProposed.replace('{{date}}', date).replace('{{time}}', time),
  });
}

function listUnder(heading: string) {
  return screen.getByRole('list', { name: heading });
}

/** The prepare form, apart from the schedule form's fields of the same name. */
function prepareForm(catalogue: typeof en | typeof pl = en) {
  return within(screen.getByRole('region', { name: catalogue.meetings.prepare }));
}

function rowOf(date: string) {
  const row = screen.getAllByRole('listitem').find((item) => item.textContent?.includes(date));
  if (!row) throw new Error(`no row for ${date}`);
  return row;
}

describe('Meetings are managed from the meetings page', () => {
  it('Upcoming and past meetings are shown apart', async () => {
    serve();
    await renderPage();

    const upcoming = within(listUnder(en.meetings.upcomingHeading)).getAllByRole('listitem');
    const past = within(listUnder(en.meetings.pastHeading)).getAllByRole('listitem');

    expect(upcoming.map((item) => item.textContent)).toEqual([
      expect.stringContaining('14 Oct 2026'),
      expect.stringContaining('21 Oct 2026'),
    ]);
    expect(past.map((item) => item.textContent)).toEqual([
      expect.stringContaining('7 Oct 2026'),
      expect.stringContaining('30 Sept 2026'),
    ]);
    expect(past[0]).toHaveTextContent('Host: bartek@example.com');
    expect(upcoming[0]).toHaveTextContent('No host');
  });

  it('Preparing the next meeting is pre-filled from the schedule', async () => {
    serve(listing(), { POST: jsonResponse(meeting('2026-10-29', '2026-10-29T08:30:00Z'), 201) });
    await renderPage();

    await userEvent.click(planControl());

    expect(prepareForm().getByLabelText(en.meetings.dateLabel)).toHaveValue('2026-10-28');
    expect(prepareForm().getByLabelText(en.meetings.timeLabel)).toHaveValue('13:00');

    fireEvent.change(prepareForm().getByLabelText(en.meetings.dateLabel), {
      target: { value: '2026-10-29' },
    });
    fireEvent.change(prepareForm().getByLabelText(en.meetings.timeLabel), {
      target: { value: '09:30' },
    });
    await userEvent.click(screen.getByRole('button', { name: en.meetings.open }));

    await vi.waitFor(() =>
      expect(sent('POST')).toEqual([
        { url: `/api/teams/${TEAM_ID}/meetings`, body: { date: '2026-10-29', time: '09:30' } },
      ]),
    );
  });

  it('The planning control names the proposal', async () => {
    serve();
    await renderPage();

    // Named before it is chosen: the date and the start time the schedule proposes.
    expect(planControl()).toHaveTextContent('Plan next meeting: Wed, 28 Oct 2026, 13:00');
  });

  it('The planning control names the proposal - in Polish', async () => {
    serve();
    await renderPage('pl');

    expect(planControl(pl)).toHaveTextContent(
      'Zaplanuj następne spotkanie: śr., 28 paź 2026, 13:00',
    );
  });

  it('Preparing a meeting without a schedule', async () => {
    serve(listing({ schedule: null, proposed: null }));
    // A member who may not configure the board.
    await renderPage('en', { email: BARTEK.email });

    await userEvent.click(screen.getByRole('button', { name: en.meetings.prepare }));

    expect(prepareForm().getByLabelText(en.meetings.dateLabel)).toHaveValue('');
    expect(prepareForm().getByLabelText(en.meetings.timeLabel)).toHaveValue('');
    expect(prepareForm().getByText(en.meetings.noProposal)).toBeInTheDocument();
    expect(screen.getByText(en.meetings.scheduleNone)).toBeInTheDocument();
    // Nothing to set: the schedule is the leader's, a deputy's or an administrator's.
    expect(screen.queryByRole('button', { name: en.meetings.setSchedule })).not.toBeInTheDocument();
  });

  it('offers whoever may configure the board to set the schedule from the planning form', async () => {
    serve(listing({ schedule: null, proposed: null }));
    await renderPage('en', { email: ANNA.email });

    await userEvent.click(screen.getByRole('button', { name: en.meetings.prepare }));
    expect(prepareForm().getByText(en.meetings.noProposal)).toBeInTheDocument();
    await userEvent.click(prepareForm().getByRole('button', { name: en.meetings.setSchedule }));

    expect(screen.getByLabelText(en.meetings.weekdayLabel)).toHaveValue('');
    expect(screen.getByRole('button', { name: en.meetings.saveSchedule })).toBeInTheDocument();
  });

  it('says nothing about a missing schedule when there is one', async () => {
    serve();
    await renderPage();

    await userEvent.click(planControl());

    expect(screen.queryByText(en.meetings.noProposal)).not.toBeInTheDocument();
  });

  it('The host is named while planning', async () => {
    const opened = meeting('2026-10-28', '2026-10-28T12:00:00Z', BARTEK);
    let created = false;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        created = true;
        return Promise.resolve(jsonResponse(opened, 201));
      }
      if (!url.endsWith('/meetings')) return Promise.resolve(jsonResponse(TEAM));
      const meetings = created ? [SEP_30, OCT_07, OCT_14, OCT_21, opened] : undefined;
      return Promise.resolve(jsonResponse(listing(meetings ? { meetings } : {})));
    });
    await renderPage();

    await userEvent.click(planControl());
    const host = prepareForm().getByLabelText(en.meetings.hostLabel);
    // Optional: nobody is chosen until someone is.
    expect(host).toHaveValue('');
    expect(
      within(host)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([en.meetings.noHost, ANNA.email, BARTEK.email]);
    await userEvent.selectOptions(host, BARTEK.employee_id);
    await userEvent.click(screen.getByRole('button', { name: en.meetings.open }));

    await vi.waitFor(() =>
      expect(sent('POST')).toEqual([
        {
          url: `/api/teams/${TEAM_ID}/meetings`,
          body: { date: '2026-10-28', time: '13:00', host_employee_id: BARTEK.employee_id },
        },
      ]),
    );
    const upcoming = await vi.waitFor(() => {
      const items = within(listUnder(en.meetings.upcomingHeading)).getAllByRole('listitem');
      expect(items).toHaveLength(3);
      return items;
    });
    expect(upcoming[2]).toHaveTextContent('28 Oct 2026');
    expect(upcoming[2]).toHaveTextContent('Host: bartek@example.com');
  });

  it('shows a host from outside the team next to the host field', async () => {
    serve(listing(), {
      POST: errorResponse(422, 'host_employee_id', 'meeting_host.not_member'),
    });
    await renderPage();

    await userEvent.click(planControl());
    await userEvent.selectOptions(
      prepareForm().getByLabelText(en.meetings.hostLabel),
      ANNA.employee_id,
    );
    await userEvent.click(screen.getByRole('button', { name: en.meetings.open }));

    expect(await prepareForm().findByRole('alert')).toHaveTextContent(
      en.errors['meeting_host.not_member'],
    );
  });

  it('A meeting leads to its board', async () => {
    serve();
    await renderWithLanguage(
      <>
        <Routes>
          <Route path="/teams/:teamId/meetings" element={<TeamMeetingsPage />} />
          <Route
            path="/teams/:teamId"
            element={<BackLink fallback={{ to: '/teams', label: en.board.back }} />}
          />
        </Routes>
        <AddressProbe />
      </>,
      'en',
      { route: `/teams/${TEAM_ID}/meetings`, auth: { isAdmin: true } },
    );
    const upcoming = await screen.findByRole('list', { name: en.meetings.upcomingHeading });

    await userEvent.click(within(upcoming).getByRole('link', { name: /14 Oct 2026/ }));

    expect(screen.getByTestId('address')).toHaveTextContent(
      new RegExp(`^/teams/${TEAM_ID}\\?meeting=${OCT_14.id}$`),
    );
    // The board's back link names the meetings page and leads back to it.
    const back = screen.getByRole('link', { name: en.back.meetings });
    await userEvent.click(back);
    expect(screen.getByTestId('address')).toHaveTextContent(`/teams/${TEAM_ID}/meetings`);
  });

  it('A rejection is shown in the active language', async () => {
    serve(listing(), { POST: errorResponse(409, 'date', 'meeting_date.taken') });
    await renderPage('pl');

    await userEvent.click(planControl(pl));
    await userEvent.click(screen.getByRole('button', { name: pl.meetings.open }));

    const message = await screen.findByText(pl.errors['meeting_date.taken']);
    expect(prepareForm(pl).getByLabelText(pl.meetings.dateLabel)).toHaveAttribute(
      'aria-describedby',
      message.id,
    );
    expect(screen.queryByText('English text for a developer')).not.toBeInTheDocument();
  });

  it('Dates and weekdays follow the active language', async () => {
    serve();
    await renderPage('en');
    expect(screen.getByText('Wednesday, 13:00')).toBeInTheDocument();
    expect(rowOf('14 Oct')).toHaveTextContent('Wed, 14 Oct 2026, 13:00');
  });

  it('Dates and weekdays follow the active language - in Polish', async () => {
    serve();
    await renderPage('pl');
    expect(screen.getByText('środa, 13:00')).toBeInTheDocument();
    expect(rowOf('14 paź')).toHaveTextContent('śr., 14 paź 2026, 13:00');
    expect(rowOf('7 paź')).toHaveTextContent('Prowadzący: bartek@example.com');
  });
});

describe('the meeting rows', () => {
  it('send only what changed when a meeting is moved and given a host', async () => {
    serve(listing(), { PATCH: jsonResponse(OCT_14) });
    await renderPage();

    await userEvent.click(
      screen.getByRole('button', { name: 'Change: meeting on Wed, 14 Oct 2026' }),
    );
    const row = rowOf('14 Oct');
    fireEvent.change(within(row).getByLabelText(en.meetings.dateLabel), {
      target: { value: '2026-10-15' },
    });
    await userEvent.selectOptions(
      within(row).getByLabelText(en.meetings.hostLabel),
      ANNA.employee_id,
    );
    await userEvent.click(within(row).getByRole('button', { name: en.meetings.save }));

    await vi.waitFor(() =>
      expect(sent('PATCH')).toEqual([
        {
          url: `/api/teams/${TEAM_ID}/meetings/${OCT_14.id}`,
          body: { date: '2026-10-15', host_employee_id: ANNA.employee_id },
        },
      ]),
    );
  });

  it('clear the host with null', async () => {
    serve(listing(), { PATCH: jsonResponse(OCT_07) });
    await renderPage();

    await userEvent.click(
      screen.getByRole('button', { name: 'Change: meeting on Wed, 7 Oct 2026' }),
    );
    const row = rowOf('7 Oct');
    await userEvent.selectOptions(within(row).getByLabelText(en.meetings.hostLabel), '');
    await userEvent.click(within(row).getByRole('button', { name: en.meetings.save }));

    await vi.waitFor(() => expect(sent('PATCH')[0]?.body).toEqual({ host_employee_id: null }));
  });

  it('show a rejected host next to the host field', async () => {
    serve(listing(), { PATCH: errorResponse(409, 'host_employee_id', 'meeting_host.not_member') });
    await renderPage();

    await userEvent.click(
      screen.getByRole('button', { name: 'Change: meeting on Wed, 14 Oct 2026' }),
    );
    const row = rowOf('14 Oct');
    await userEvent.selectOptions(
      within(row).getByLabelText(en.meetings.hostLabel),
      BARTEK.employee_id,
    );
    await userEvent.click(within(row).getByRole('button', { name: en.meetings.save }));

    expect(await within(row).findByRole('alert')).toHaveTextContent(
      en.errors['meeting_host.not_member'],
    );
  });

  it('delete a meeting', async () => {
    serve(listing(), {
      DELETE: { ok: true, status: 204, json: async () => undefined } as Response,
    });
    await renderPage();

    await userEvent.click(
      screen.getByRole('button', { name: 'Delete: meeting on Wed, 21 Oct 2026' }),
    );

    await vi.waitFor(() =>
      expect(sent('DELETE')).toEqual([
        { url: `/api/teams/${TEAM_ID}/meetings/${OCT_21.id}`, body: undefined },
      ]),
    );
  });

  it('report a meeting that no longer exists', async () => {
    serve(listing(), { DELETE: errorResponse(404, null, 'meeting.not_found') });
    await renderPage();

    await userEvent.click(
      screen.getByRole('button', { name: 'Delete: meeting on Wed, 21 Oct 2026' }),
    );

    expect(await within(rowOf('21 Oct')).findByRole('alert')).toHaveTextContent(
      en.errors['meeting.not_found'],
    );
  });
});

describe('the schedule', () => {
  it('is saved with the weekday and time chosen', async () => {
    serve(listing({ schedule: null, proposed: null }), { PUT: jsonResponse({}) });
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: en.meetings.setSchedule }));

    await userEvent.selectOptions(screen.getByLabelText(en.meetings.weekdayLabel), '2');
    fireEvent.change(screen.getByLabelText(en.meetings.timeLabel), {
      target: { value: '09:30' },
    });
    await userEvent.click(screen.getByRole('button', { name: en.meetings.saveSchedule }));

    await vi.waitFor(() =>
      expect(sent('PUT')).toEqual([
        { url: `/api/teams/${TEAM_ID}/schedule`, body: { weekday: 2, time: '09:30' } },
      ]),
    );
  });

  it('shows a rejected weekday next to its field', async () => {
    serve(listing({ schedule: null, proposed: null }), {
      PUT: errorResponse(422, 'weekday', 'schedule_weekday.out_of_range'),
    });
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: en.meetings.setSchedule }));

    await userEvent.click(screen.getByRole('button', { name: en.meetings.saveSchedule }));

    expect(await screen.findByText(en.errors['schedule_weekday.out_of_range'])).toBeInTheDocument();
  });

  it('The schedule fields are hidden until asked for', async () => {
    serve(listing());
    await renderPage();

    expect(screen.getByText('Wednesday, 13:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.meetings.changeSchedule })).toBeInTheDocument();
    expect(screen.queryByLabelText(en.meetings.weekdayLabel)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: en.meetings.saveSchedule }),
    ).not.toBeInTheDocument();
  });

  it('A board without a schedule offers to set one', async () => {
    serve(listing({ schedule: null, proposed: null }));
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: en.meetings.setSchedule }));

    expect(screen.getByLabelText(en.meetings.weekdayLabel)).toHaveValue('');
    expect(screen.getByLabelText(en.meetings.timeLabel)).toHaveValue('');
    expect(screen.getByRole('button', { name: en.meetings.saveSchedule })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: en.meetings.cancel }));
    expect(screen.queryByLabelText(en.meetings.weekdayLabel)).not.toBeInTheDocument();
  });

  it('Saving hides the fields', async () => {
    serve(listing(), { PUT: jsonResponse({}) });
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: en.meetings.changeSchedule }));
    expect(screen.getByLabelText(en.meetings.weekdayLabel)).toHaveValue('3');

    await userEvent.selectOptions(screen.getByLabelText(en.meetings.weekdayLabel), '4');
    await userEvent.click(screen.getByRole('button', { name: en.meetings.saveSchedule }));

    await vi.waitFor(() =>
      expect(screen.queryByLabelText(en.meetings.weekdayLabel)).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: en.meetings.changeSchedule })).toBeInTheDocument();
  });

  it('sizes each field to what it holds', async () => {
    serve(listing());
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: en.meetings.changeSchedule }));
    await userEvent.click(planControl());

    // The layout itself is the e2e flow's to measure; here, each field
    // carries its own width rather than the page's.
    for (const field of [
      screen.getByLabelText(en.meetings.weekdayLabel),
      ...screen.getAllByLabelText(en.meetings.timeLabel),
      prepareForm().getByLabelText(en.meetings.dateLabel),
    ]) {
      expect(field.closest('div')!.className).toMatch(/weekdayField|timeField|dateField/);
    }
  });
});

describe('a team that cannot be read', () => {
  it('says the team was not found', async () => {
    fetchMock.mockResolvedValue(errorResponse(404, null, 'team.not_found'));
    await renderWithLanguage(
      <Routes>
        <Route path="/teams/:teamId/meetings" element={<TeamMeetingsPage />} />
      </Routes>,
      'en',
      { route: '/teams/missing/meetings', auth: { isAdmin: true } },
    );

    expect(await screen.findByRole('heading', { name: en.meetings.notFound })).toBeInTheDocument();
  });
});

describe('the meetings page follows the one button scheme', () => {
  it('Actions on different pages look alike', async () => {
    // specs/appearance/spec.md, by class: controls.default composes
    // controls.button, so every action carries it.
    serve();
    await renderPage();

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(1);
    for (const button of buttons) {
      expect(button).toHaveClass(controls.button!);
    }
  });

  it("The meetings page's own links are links", async () => {
    serve();
    await renderPage();

    for (const name of [en.teams.boardLink, en.board.settingsLink]) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveClass(controls.link!);
      expect(link).not.toHaveClass(controls.button!);
      expect(link.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    }
  });
});
