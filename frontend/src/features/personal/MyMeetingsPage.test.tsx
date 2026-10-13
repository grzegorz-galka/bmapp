/** "My meetings" in specs/dashboard/spec.md. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { renderWithLanguage } from '../../test/render';
import { AddressProbe } from '../../test/AddressProbe';
import { en } from '../../i18n/en';
import { dashboardSummary } from '../dashboard/dashboardFixture';
import { MyMeetingsPage } from './MyMeetingsPage';
import { NOW, serve } from './personalFixture';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  serve(fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const section = (name: string) => screen.getByRole('region', { name });
const rowNames = (name: string) =>
  within(section(name))
    .getAllByRole('link')
    .map((link) => link.textContent);

describe('My meetings', () => {
  it('Meetings of several teams are shown together', async () => {
    await renderWithLanguage(<MyMeetingsPage />, 'en');
    await screen.findByRole('region', { name: en.meetings.upcomingHeading });

    expect(rowNames(en.meetings.upcomingHeading)).toEqual([
      expect.stringMatching(/^Platform Core · .*14/),
      expect.stringMatching(/^Payments · .*16/),
    ]);
    expect(rowNames(en.meetings.pastHeading)).toEqual([
      expect.stringMatching(/^Platform Core · .*7/),
      expect.stringMatching(/^Payments · .*5/),
    ]);
    expect(
      within(section(en.meetings.pastHeading)).getByText(/anna@example\.com/),
    ).toBeInTheDocument();
  });

  it('A meeting leads to its board', async () => {
    await renderWithLanguage(
      <>
        <Routes>
          <Route path="/" element={<MyMeetingsPage />} />
          <Route path="/teams/:teamId" element={<p>board</p>} />
        </Routes>
        <AddressProbe />
      </>,
      'en',
    );
    const upcoming = await screen.findByRole('region', { name: en.meetings.upcomingHeading });

    await userEvent.click(within(upcoming).getAllByRole('link')[0]!);

    expect(screen.getByTestId('address')).toHaveTextContent(
      '/teams/platform-core?meeting=platform-core-2026-10-14',
    );
  });

  it('says so when the viewer has no meetings', async () => {
    fetchMock.mockReset();
    serve(fetchMock, {
      summary: dashboardSummary({ teams: [] }),
    });
    await renderWithLanguage(<MyMeetingsPage />, 'en');

    expect(await screen.findByText(en.personal.noMeetings)).toBeInTheDocument();
  });
});
