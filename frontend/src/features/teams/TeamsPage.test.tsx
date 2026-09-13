import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TeamsPage } from './TeamsPage';
import type { Team } from '../../api/teams';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TeamsPage />
    </QueryClientProvider>,
  );
}

function team(name: string): Team {
  return { id: `id-${name}`, name, board: { id: `board-${name}`, name } };
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TeamsPage', () => {
  it('renders the teams in the order the API returned them', async () => {
    fetchMock.mockResolvedValue(jsonResponse([team('alpha'), team('Platform'), team('Quality')]));

    renderPage();

    const items = await screen.findAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'alpha — board: alpha',
      'Platform — board: Platform',
      'Quality — board: Quality',
    ]);
  });

  it('reports when no teams are registered yet', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    renderPage();

    expect(await screen.findByText('No teams registered yet.')).toBeInTheDocument();
  });

  it('shows a newly registered team without a manual reload', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(team('Platform'), 201))
      .mockResolvedValueOnce(jsonResponse([team('Platform')]));

    renderPage();
    await screen.findByText('No teams registered yet.');

    await userEvent.type(screen.getByLabelText('Team name'), 'Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Register team' }));

    expect(await screen.findByText('Platform — board: Platform')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Team name')).toHaveValue(''));
  });

  it('surfaces a rejected blank name against the name field', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse({ errors: [{ field: 'name', message: 'Team name must not be blank.' }] }, 422),
      );

    renderPage();
    await screen.findByText('No teams registered yet.');

    await userEvent.click(screen.getByRole('button', { name: 'Register team' }));

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('Team name must not be blank.');
    expect(screen.getByLabelText('Team name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('surfaces a rejected duplicate name against the name field', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([team('Platform')]))
      .mockResolvedValueOnce(
        jsonResponse(
          { errors: [{ field: 'name', message: "A team named 'Platform' already exists." }] },
          409,
        ),
      );

    renderPage();
    await screen.findByText('Platform — board: Platform');

    await userEvent.type(screen.getByLabelText('Team name'), 'platform');
    await userEvent.click(screen.getByRole('button', { name: 'Register team' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "A team named 'Platform' already exists.",
    );
  });
});
