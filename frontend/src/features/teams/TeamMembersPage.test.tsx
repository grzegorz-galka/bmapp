/**
 * The members page. One test per scenario of "Members are managed from the
 * team page" in specs/team-membership/spec.md that concerns this page; the
 * two registration scenarios are in TeamsPage.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { TeamMembersPage } from './TeamMembersPage';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import type { Language } from '../../i18n/languages';
import type { Member, TeamDetail } from '../../api/teams';

const TEAM_ID = 'team-1';
const LEADER = member('anna@example.com', true);
const BARTEK = member('bartek@example.com');
const CELINA = member('celina@example.com');

function member(email: string, isLeader = false): Member {
  return { employee_id: `emp-${email.split('@')[0]}`, email, is_leader: isLeader };
}

function detail(...members: Member[]): TeamDetail {
  return { id: TEAM_ID, name: 'Platform', board: { id: 'board-1', name: 'Platform' }, members };
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function errorResponse(status: number, field: string | null, code: string, message: string) {
  return jsonResponse({ errors: [{ field, code, message }] }, status);
}

/**
 * Answers the page's requests: GET with `team`, and each mutation with
 * whatever the test queued for its method.
 */
function serve(team: Response, mutations: Partial<Record<string, Response>> = {}) {
  fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    return Promise.resolve(method === 'GET' ? team : mutations[method]);
  });
}

/** The one request sent with `method`, failing if there was not exactly one. */
function onlyRequest(method: string): { url: string; body: unknown } {
  const sent = (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
    ([, init]) => (init?.method ?? 'GET') === method,
  );
  expect(sent).toHaveLength(1);
  const [url, init] = sent[0] ?? ['', undefined];
  return { url, body: init?.body ? JSON.parse(String(init.body)) : undefined };
}

async function renderPage(language: Language = 'en', teamId = TEAM_ID) {
  await renderWithLanguage(
    <Routes>
      <Route path="/teams/:teamId/members" element={<TeamMembersPage />} />
      <Route path="/teams" element={<p>the team list</p>} />
    </Routes>,
    language,
    { route: `/teams/${teamId}/members` },
  );
}

function memberList() {
  return screen.getByRole('list', { name: en.members.listLabel });
}

function rowOf(email: string) {
  const row = within(memberList())
    .getAllByRole('listitem')
    .find((item) => item.textContent?.includes(email));
  if (!row) throw new Error(`no row for ${email}`);
  return row;
}

function emails() {
  return within(memberList())
    .getAllByRole('listitem')
    .map((item) => /\S+@example\.com/.exec(item.textContent ?? '')?.[0]);
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('Members are managed from the team page', () => {
  it('A member is added from the members page', async () => {
    serve(jsonResponse(detail(LEADER)), { POST: jsonResponse(detail(LEADER, BARTEK), 201) });
    await renderPage();
    await screen.findByRole('heading', { name: 'Members of Platform' });

    await userEvent.type(screen.getByLabelText(en.members.emailLabel), 'bartek@example.com');
    await userEvent.click(screen.getByRole('button', { name: en.members.add }));

    const row = await screen.findByText('bartek@example.com');
    expect(rowOf('bartek@example.com')).not.toHaveTextContent(en.members.leader);
    expect(row).toBeInTheDocument();
    expect(screen.getByLabelText(en.members.emailLabel)).toHaveValue('');
    expect(onlyRequest('POST')).toEqual({
      url: `/api/teams/${TEAM_ID}/members`,
      body: { email: 'bartek@example.com' },
    });
  });

  it('A duplicate member is reported', async () => {
    serve(jsonResponse(detail(LEADER, BARTEK)), {
      POST: errorResponse(409, 'email', 'team_member.duplicate', 'Already a member.'),
    });
    await renderPage();
    await screen.findByRole('heading', { name: 'Members of Platform' });

    await userEvent.type(screen.getByLabelText(en.members.emailLabel), 'BARTEK@example.com');
    await userEvent.click(screen.getByRole('button', { name: en.members.add }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(en.errors['team_member.duplicate']);
    expect(document.body.textContent).not.toContain('Already a member.');
    const field = screen.getByLabelText(en.members.emailLabel);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAttribute('aria-describedby', alert.id);
    expect(emails()).toEqual(['anna@example.com', 'bartek@example.com']);
  });

  it('A member is removed from the members page', async () => {
    serve(jsonResponse(detail(LEADER, BARTEK, CELINA)), {
      DELETE: jsonResponse(detail(LEADER, CELINA)),
    });
    await renderPage();
    await screen.findByText('bartek@example.com');

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove from team: bartek@example.com' }),
    );

    expect(await screen.findByText('celina@example.com')).toBeInTheDocument();
    expect(screen.queryByText('bartek@example.com')).not.toBeInTheDocument();
    expect(onlyRequest('DELETE').url).toBe(`/api/teams/${TEAM_ID}/members/${BARTEK.employee_id}`);
  });

  it('The leader offers no remove action', async () => {
    serve(jsonResponse(detail(LEADER, BARTEK, CELINA)));
    await renderPage();
    await screen.findByText('anna@example.com');

    expect(within(rowOf('anna@example.com')).queryAllByRole('button')).toHaveLength(0);
    expect(rowOf('anna@example.com')).toHaveTextContent(en.members.leader);
    for (const email of ['bartek@example.com', 'celina@example.com']) {
      const row = within(rowOf(email));
      expect(row.getByRole('button', { name: `Remove from team: ${email}` })).toBeVisible();
      expect(row.getByRole('button', { name: `Make leader: ${email}` })).toBeVisible();
      expect(rowOf(email)).not.toHaveTextContent(en.members.leader);
    }
  });

  it('Leadership is handed over from the members page', async () => {
    const bartekLeads = detail({ ...LEADER, is_leader: false }, { ...BARTEK, is_leader: true });
    serve(jsonResponse(detail(LEADER, BARTEK)), { PUT: jsonResponse(bartekLeads) });
    await renderPage();
    await screen.findByText('bartek@example.com');

    await userEvent.click(screen.getByRole('button', { name: 'Make leader: bartek@example.com' }));

    expect(
      await screen.findByRole('button', { name: 'Remove from team: anna@example.com' }),
    ).toBeVisible();
    expect(rowOf('bartek@example.com')).toHaveTextContent(en.members.leader);
    expect(within(rowOf('bartek@example.com')).queryAllByRole('button')).toHaveLength(0);
    expect(rowOf('anna@example.com')).not.toHaveTextContent(en.members.leader);
    expect(
      within(rowOf('anna@example.com')).getByRole('button', {
        name: 'Make leader: anna@example.com',
      }),
    ).toBeVisible();
    expect(onlyRequest('PUT')).toEqual({
      url: `/api/teams/${TEAM_ID}/leader`,
      body: { employee_id: BARTEK.employee_id },
    });
  });

  it('The members page of a missing team', async () => {
    serve(errorResponse(404, null, 'team.not_found', 'No such team.'));
    await renderPage();

    expect(await screen.findByRole('heading', { name: en.members.notFound })).toBeInTheDocument();
    expect(screen.queryByLabelText(en.members.emailLabel)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: en.members.back }));

    expect(await screen.findByText('the team list')).toBeInTheDocument();
  });

  it('The members page reads in Polish', async () => {
    serve(jsonResponse(detail(LEADER, BARTEK)), {
      POST: errorResponse(409, 'email', 'team_member.duplicate', 'Already a member.'),
    });
    await renderPage('pl');

    expect(
      await screen.findByRole('heading', { name: 'Członkowie zespołu Platform' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: pl.members.back })).toBeVisible();
    expect(screen.getByRole('list', { name: pl.members.listLabel })).toBeVisible();
    expect(screen.getByText(pl.members.leader)).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Usuń z zespołu: bartek@example.com' }),
    ).toHaveTextContent(pl.members.remove);
    expect(
      screen.getByRole('button', { name: 'Ustaw jako lidera: bartek@example.com' }),
    ).toHaveTextContent(pl.members.makeLeader);

    await userEvent.type(screen.getByLabelText(pl.members.emailLabel), 'bartek@example.com');
    await userEvent.click(screen.getByRole('button', { name: pl.members.add }));

    expect(await screen.findByRole('alert')).toHaveTextContent(pl.errors['team_member.duplicate']);
    for (const english of [
      en.members.heading.replace('{{name}}', 'Platform'),
      en.members.back,
      en.members.leader,
      en.members.emailLabel,
      en.members.add,
      en.members.remove,
      en.members.makeLeader,
      en.errors['team_member.duplicate'],
    ]) {
      expect(document.body.textContent).not.toContain(english);
    }
  });
});

describe('the members page otherwise', () => {
  it('says it is loading before the team arrives', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    await renderPage();

    expect(screen.getByText(en.members.loading)).toBeInTheDocument();
  });

  it('reports a failed load, distinct from a missing team', async () => {
    serve(jsonResponse({ errors: [] }, 500));
    await renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(en.members.loadFailed);
    expect(screen.queryByText(en.members.notFound)).not.toBeInTheDocument();
  });

  it('treats a malformed team identifier as a missing team', async () => {
    serve(errorResponse(422, 'team_id', 'request.invalid_field', 'Not a UUID.'));
    await renderPage('en', 'not-a-uuid');

    expect(await screen.findByRole('heading', { name: en.members.notFound })).toBeInTheDocument();
  });

  it('shows a rejected action next to the member it concerns', async () => {
    serve(jsonResponse(detail(LEADER, BARTEK, CELINA)), {
      PUT: errorResponse(409, 'employee_id', 'team_leader.not_member', 'Not a member.'),
    });
    await renderPage();
    await screen.findByText('celina@example.com');

    await userEvent.click(screen.getByRole('button', { name: 'Make leader: celina@example.com' }));

    const alert = await within(rowOf('celina@example.com')).findByRole('alert');
    expect(alert).toHaveTextContent(en.errors['team_leader.not_member']);
    expect(within(rowOf('bartek@example.com')).queryByRole('alert')).not.toBeInTheDocument();
  });
});
