import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamsPage } from './TeamsPage';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import type { Team } from '../../api/teams';

function team(name: string, leaderEmail = 'lead@example.com', memberCount = 1): Team {
  return {
    id: `id-${name}`,
    name,
    board: { id: `board-${name}`, name },
    leader: { id: `leader-${name}`, email: leaderEmail },
    member_count: memberCount,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

/** The error body shape the API uses: a code to translate, English for a dev. */
function fieldError(code: string, message: string, status = 409, field = 'name') {
  return jsonResponse({ errors: [{ field, code, message }] }, status);
}

/** Fill in both registration fields and submit, in whichever language is active. */
async function register(catalogue: typeof en | typeof pl, name: string, leaderEmail: string) {
  await userEvent.type(screen.getByLabelText(catalogue.teams.nameLabel), name);
  await userEvent.type(screen.getByLabelText(catalogue.teams.leaderEmailLabel), leaderEmail);
  await userEvent.click(screen.getByRole('button', { name: catalogue.teams.register }));
}

const DUPLICATE_MESSAGE = "A team named 'Platform' already exists.";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('TeamsPage in English', () => {
  it('renders the teams in the order the API returned them', async () => {
    fetchMock.mockResolvedValue(jsonResponse([team('alpha'), team('Platform'), team('Quality')]));

    await renderWithLanguage(<TeamsPage />, 'en', { auth: { isAdmin: true } });

    const items = await screen.findAllByRole('listitem');
    expect(items.map((item) => within(item).getByText(/ — board: /).textContent)).toEqual([
      'alpha — board: alpha',
      'Platform — board: Platform',
      'Quality — board: Quality',
    ]);
  });

  it("shows each team's leader, member count and a link to its members page", async () => {
    fetchMock.mockResolvedValue(jsonResponse([team('Platform', 'anna@example.com', 3)]));

    await renderWithLanguage(<TeamsPage />, 'en', { auth: { isAdmin: true } });

    const item = await screen.findByRole('listitem');
    expect(item).toHaveTextContent('leader: anna@example.com');
    expect(item).toHaveTextContent('Members: 3');
    expect(within(item).getByRole('link', { name: 'Members of Platform' })).toHaveAttribute(
      'href',
      '/teams/id-Platform/members',
    );
  });

  it('reports when no teams are registered yet', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await renderWithLanguage(<TeamsPage />, 'en', { auth: { isAdmin: true } });

    expect(await screen.findByText(en.teams.empty)).toBeInTheDocument();
  });

  it('reports when the list could not be loaded', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ errors: [] }, 500));

    await renderWithLanguage(<TeamsPage />, 'en', { auth: { isAdmin: true } });

    expect(await screen.findByText(en.teams.loadFailed)).toBeInTheDocument();
  });

  it('shows a newly registered team without a manual reload', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(team('Platform'), 201))
      .mockResolvedValue(jsonResponse([team('Platform')]));

    await renderWithLanguage(<TeamsPage />, 'en', { auth: { isAdmin: true } });
    await screen.findByText(en.teams.empty);

    await register(en, 'Platform', 'lead@example.com');

    expect(await screen.findByRole('listitem')).toHaveTextContent('Platform — board: Platform');
  });
});

describe('Members are managed from the team page', () => {
  it('A team is registered with its leader from the page', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(team('Platform', 'anna@example.com'), 201))
      .mockResolvedValue(jsonResponse([team('Platform', 'anna@example.com', 1)]));

    await renderWithLanguage(<TeamsPage />, 'en', { auth: { isAdmin: true } });
    await screen.findByText(en.teams.empty);

    await register(en, 'Platform', 'anna@example.com');

    const item = await screen.findByRole('listitem');
    expect(item).toHaveTextContent('leader: anna@example.com');
    expect(item).toHaveTextContent('Members: 1');
    expect(screen.getByLabelText(en.teams.nameLabel)).toHaveValue('');
    expect(screen.getByLabelText(en.teams.leaderEmailLabel)).toHaveValue('');

    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'Platform',
      leader_email: 'anna@example.com',
    });
  });

  it('A rejected leader email is shown on its field', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValue(
        fieldError('employee_email.invalid', 'Not an email address.', 422, 'leader_email'),
      );

    await renderWithLanguage(<TeamsPage />, 'en', { auth: { isAdmin: true } });
    await screen.findByText(en.teams.empty);

    await register(en, 'Platform', 'not-an-email');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(en.errors['employee_email.invalid']);
    const leaderEmail = screen.getByLabelText(en.teams.leaderEmailLabel);
    expect(leaderEmail).toHaveAttribute('aria-invalid', 'true');
    expect(leaderEmail).toHaveAttribute('aria-describedby', alert.id);
    // The name was fine: it is kept, and not marked as the problem.
    const name = screen.getByLabelText(en.teams.nameLabel);
    expect(name).toHaveValue('Platform');
    expect(name).toHaveAttribute('aria-invalid', 'false');
  });
});

describe('TeamsPage in Polish', () => {
  it('renders every string in Polish', async () => {
    fetchMock.mockResolvedValue(jsonResponse([team('Platform')]));

    await renderWithLanguage(<TeamsPage />, 'pl', { auth: { isAdmin: true } });

    // A team name is data, not text to translate, but the label around it is.
    const item = await screen.findByRole('listitem');
    expect(item).toHaveTextContent('Platform — tablica: Platform');
    expect(item).toHaveTextContent('lider zespołu: lead@example.com');
    expect(item).toHaveTextContent('Liczba członków: 1');
    expect(within(item).getByRole('link', { name: 'Członkowie zespołu Platform' })).toBeVisible();
    expect(screen.getByRole('heading', { name: pl.teams.heading })).toBeInTheDocument();
    expect(screen.getByLabelText(pl.teams.nameLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(pl.teams.leaderEmailLabel)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: pl.teams.register })).toBeInTheDocument();
    expect(screen.queryByText(en.teams.heading)).not.toBeInTheDocument();
  });

  it('reports an empty list in Polish', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await renderWithLanguage(<TeamsPage />, 'pl', { auth: { isAdmin: true } });

    expect(await screen.findByText(pl.teams.empty)).toBeInTheDocument();
  });

  it('reports a failed load in Polish', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ errors: [] }, 500));

    await renderWithLanguage(<TeamsPage />, 'pl', { auth: { isAdmin: true } });

    expect(await screen.findByText(pl.teams.loadFailed)).toBeInTheDocument();
  });
});

describe('an error the API reports against a field', () => {
  it('is shown in English, using our wording and not the API text', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValue(fieldError('team_name.duplicate', DUPLICATE_MESSAGE));

    await renderWithLanguage(<TeamsPage />, 'en', { auth: { isAdmin: true } });
    await screen.findByText(en.teams.empty);

    await register(en, 'Platform', 'lead@example.com');

    expect(await screen.findByRole('alert')).toHaveTextContent(en.errors['team_name.duplicate']);
    expect(screen.queryByText(DUPLICATE_MESSAGE)).not.toBeInTheDocument();
    expect(screen.getByLabelText(en.teams.nameLabel)).toHaveAttribute('aria-invalid', 'true');
  });

  it('is shown in Polish, and the API English text appears nowhere', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValue(fieldError('team_name.duplicate', DUPLICATE_MESSAGE));

    await renderWithLanguage(<TeamsPage />, 'pl', { auth: { isAdmin: true } });
    await screen.findByText(pl.teams.empty);

    await register(pl, 'Platform', 'lead@example.com');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(pl.errors['team_name.duplicate']);
    expect(document.body.textContent).not.toContain(DUPLICATE_MESSAGE);
    expect(document.body.textContent).not.toContain(en.errors['team_name.duplicate']);
  });

  it('falls back to a generic message in the active language for an unknown code', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValue(fieldError('team_name.cursed', 'A reason this build never heard of.'));

    await renderWithLanguage(<TeamsPage />, 'pl', { auth: { isAdmin: true } });
    await screen.findByText(pl.teams.empty);

    await register(pl, 'Platform', 'lead@example.com');

    expect(await screen.findByRole('alert')).toHaveTextContent(pl.errors.generic);
    expect(document.body.textContent).not.toContain('A reason this build never heard of.');
    // The error is still attributed to the field the API named.
    expect(screen.getByLabelText(pl.teams.nameLabel)).toHaveAttribute('aria-invalid', 'true');
  });
});
