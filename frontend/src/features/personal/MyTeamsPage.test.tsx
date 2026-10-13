/** "My teams" in specs/dashboard/spec.md. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import { dashboardSummary } from '../dashboard/dashboardFixture';
import { MyTeamsPage } from './MyTeamsPage';
import { serve } from './personalFixture';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

describe('My teams', () => {
  it("The viewer's teams are listed with their links", async () => {
    serve(fetchMock);
    await renderWithLanguage(<MyTeamsPage />, 'en');

    const rows = await screen.findAllByRole('listitem');
    expect(
      rows.map(
        (row) => within(row).getByText(/^(Platform Core|Payments|Infrastructure)$/).textContent,
      ),
    ).toEqual(['Platform Core', 'Payments', 'Infrastructure']);
    const platform = within(rows[0]!);
    expect(rows[0]).toHaveTextContent(`${en.myTeams.role_leader} ·`);
    expect(rows[1]).toHaveTextContent(`${en.myTeams.role_member} ·`);
    expect(platform.getByRole('link', { name: 'Board of Platform Core' })).toHaveAttribute(
      'href',
      '/teams/platform-core',
    );
    expect(platform.getByRole('link', { name: 'Meetings of Platform Core' })).toHaveAttribute(
      'href',
      '/teams/platform-core/meetings',
    );
    expect(platform.getByRole('link', { name: 'Members of Platform Core' })).toHaveAttribute(
      'href',
      '/teams/platform-core/members',
    );
    expect(platform.getByRole('link', { name: 'Metrics of Platform Core' })).toHaveAttribute(
      'href',
      '/teams/platform-core/metrics',
    );
  });

  it('A viewer of no team', async () => {
    serve(fetchMock, { summary: dashboardSummary({ teams: [] }) });
    await renderWithLanguage(<MyTeamsPage />, 'en');

    expect(await screen.findByText(en.personal.noTeams)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
