import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamsPage } from './TeamsPage';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import type { Team } from '../../api/teams';

function team(name: string): Team {
  return { id: `id-${name}`, name, board: { id: `board-${name}`, name } };
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

/** The error body shape the API uses: a code to translate, English for a dev. */
function fieldError(code: string, message: string, status = 409) {
  return jsonResponse({ errors: [{ field: 'name', code, message }] }, status);
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

    await renderWithLanguage(<TeamsPage />, 'en');

    const items = await screen.findAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'alpha — board: alpha',
      'Platform — board: Platform',
      'Quality — board: Quality',
    ]);
  });

  it('reports when no teams are registered yet', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await renderWithLanguage(<TeamsPage />, 'en');

    expect(await screen.findByText(en.teams.empty)).toBeInTheDocument();
  });

  it('reports when the list could not be loaded', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ errors: [] }, 500));

    await renderWithLanguage(<TeamsPage />, 'en');

    expect(await screen.findByText(en.teams.loadFailed)).toBeInTheDocument();
  });

  it('shows a newly registered team without a manual reload', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(team('Platform'), 201))
      .mockResolvedValue(jsonResponse([team('Platform')]));

    await renderWithLanguage(<TeamsPage />, 'en');
    await screen.findByText(en.teams.empty);

    await userEvent.type(screen.getByLabelText(en.teams.nameLabel), 'Platform');
    await userEvent.click(screen.getByRole('button', { name: en.teams.register }));

    expect(await screen.findByRole('listitem')).toHaveTextContent('Platform — board: Platform');
  });
});

describe('TeamsPage in Polish', () => {
  it('renders every string in Polish', async () => {
    fetchMock.mockResolvedValue(jsonResponse([team('Platform')]));

    await renderWithLanguage(<TeamsPage />, 'pl');

    // A team name is data, not text to translate, but the label around it is.
    expect(await screen.findByRole('listitem')).toHaveTextContent('Platform — tablica: Platform');
    expect(screen.getByRole('heading', { name: pl.teams.heading })).toBeInTheDocument();
    expect(screen.getByLabelText(pl.teams.nameLabel)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: pl.teams.register })).toBeInTheDocument();
    expect(screen.queryByText(en.teams.heading)).not.toBeInTheDocument();
  });

  it('reports an empty list in Polish', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await renderWithLanguage(<TeamsPage />, 'pl');

    expect(await screen.findByText(pl.teams.empty)).toBeInTheDocument();
  });

  it('reports a failed load in Polish', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ errors: [] }, 500));

    await renderWithLanguage(<TeamsPage />, 'pl');

    expect(await screen.findByText(pl.teams.loadFailed)).toBeInTheDocument();
  });
});

describe('an error the API reports against a field', () => {
  it('is shown in English, using our wording and not the API text', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValue(fieldError('team_name.duplicate', DUPLICATE_MESSAGE));

    await renderWithLanguage(<TeamsPage />, 'en');
    await screen.findByText(en.teams.empty);

    await userEvent.type(screen.getByLabelText(en.teams.nameLabel), 'Platform');
    await userEvent.click(screen.getByRole('button', { name: en.teams.register }));

    expect(await screen.findByRole('alert')).toHaveTextContent(en.errors['team_name.duplicate']);
    expect(screen.queryByText(DUPLICATE_MESSAGE)).not.toBeInTheDocument();
    expect(screen.getByLabelText(en.teams.nameLabel)).toHaveAttribute('aria-invalid', 'true');
  });

  it('is shown in Polish, and the API English text appears nowhere', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValue(fieldError('team_name.duplicate', DUPLICATE_MESSAGE));

    await renderWithLanguage(<TeamsPage />, 'pl');
    await screen.findByText(pl.teams.empty);

    await userEvent.type(screen.getByLabelText(pl.teams.nameLabel), 'Platform');
    await userEvent.click(screen.getByRole('button', { name: pl.teams.register }));

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

    await renderWithLanguage(<TeamsPage />, 'pl');
    await screen.findByText(pl.teams.empty);

    await userEvent.type(screen.getByLabelText(pl.teams.nameLabel), 'Platform');
    await userEvent.click(screen.getByRole('button', { name: pl.teams.register }));

    expect(await screen.findByRole('alert')).toHaveTextContent(pl.errors.generic);
    expect(document.body.textContent).not.toContain('A reason this build never heard of.');
    // The error is still attributed to the field the API named.
    expect(screen.getByLabelText(pl.teams.nameLabel)).toHaveAttribute('aria-invalid', 'true');
  });
});
