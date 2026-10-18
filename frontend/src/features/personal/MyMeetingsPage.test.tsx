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
import { MEETINGS, NOW, serve, teamMeeting } from './personalFixture';

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

describe("The viewer's own meetings to host are marked", () => {
  /** Platform Core's meeting on the 14th, hosted by `host`. */
  function hostedBy(host: string) {
    fetchMock.mockReset();
    serve(fetchMock, {
      meetings: {
        ...MEETINGS,
        'platform-core': {
          ...MEETINGS['platform-core']!,
          meetings: [
            teamMeeting('platform-core', '2026-10-07', 'anna@example.com'),
            teamMeeting('platform-core', '2026-10-14', host),
          ],
        },
      },
    });
  }

  const upcomingRow = () =>
    within(section(en.meetings.upcomingHeading))
      .getAllByRole('listitem')
      .find((item) => item.textContent?.includes('Platform Core'))!;

  it('The host sees their meeting marked', async () => {
    // The viewer of the summary, in another case: compared lower-cased.
    hostedBy('G.Galka@pse.pl');
    await renderWithLanguage(<MyMeetingsPage />, 'en');
    await screen.findByRole('region', { name: en.meetings.upcomingHeading });

    const row = upcomingRow();
    expect(row).toHaveTextContent(en.meetings.youHost);
    expect(row).not.toHaveTextContent(/galka/i);
  });

  it("Another member's meeting is not marked", async () => {
    hostedBy('ewa@example.com');
    await renderWithLanguage(<MyMeetingsPage />, 'en');
    await screen.findByRole('region', { name: en.meetings.upcomingHeading });

    const row = upcomingRow();
    expect(row).toHaveTextContent('Host: ewa@example.com');
    expect(row).not.toHaveTextContent(en.meetings.youHost);
  });
});
