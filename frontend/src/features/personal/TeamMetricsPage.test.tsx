/** "Team metrics" in specs/dashboard/spec.md. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { renderWithLanguage } from '../../test/render';
import { AddressProbe } from '../../test/AddressProbe';
import { en } from '../../i18n/en';
import { TeamMetricsPage } from './TeamMetricsPage';
import { serve } from './personalFixture';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  serve(fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('Team metrics', () => {
  it('A team is chosen for its metric settings', async () => {
    await renderWithLanguage(
      <>
        <Routes>
          <Route path="/" element={<TeamMetricsPage />} />
          <Route path="/teams/:teamId/metrics" element={<p>settings</p>} />
        </Routes>
        <AddressProbe />
      </>,
      'en',
    );

    await userEvent.click(await screen.findByRole('link', { name: 'Platform Core' }));

    expect(screen.getByTestId('address')).toHaveTextContent(/^\/teams\/platform-core\/metrics$/);
  });

  it("The viewer's own teams come first", async () => {
    await renderWithLanguage(<TeamMetricsPage />, 'en');
    await screen.findByRole('link', { name: 'Platform Core' });

    const names = screen
      .getAllByRole('listitem')
      .map((row) => within(row).getByRole('link').textContent);
    // The viewer's three first, then the other two, each part by name.
    expect(names).toEqual(['Infrastructure', 'Payments', 'Platform Core', 'Analytics', 'Zeta']);
    expect(screen.getAllByText(en.personal.yourTeam)).toHaveLength(3);
  });
});
