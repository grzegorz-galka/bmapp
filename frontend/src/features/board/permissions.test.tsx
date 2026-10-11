/**
 * Requirement: The interface offers only what its viewer may do - on the
 * board and the metric settings. The server refuses regardless; these are
 * about not offering a control the person cannot use, while still showing
 * everything they may read.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { BoardPage } from './BoardPage';
import { MetricSettingsPage } from '../metrics/MetricSettingsPage';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import type { Metric } from '../../api/metrics';
import {
  ADMIN,
  board,
  definition,
  jsonResponse,
  LEADER,
  MEETINGS,
  MEMBER,
  MONDAY,
  serveBoard,
  TEAM_ID,
  threshold,
  TREND,
} from './boardFixture';

const fetchMock = vi.fn();
const METRICS: Metric[] = [{ ...definition(), threshold: threshold() }];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MONDAY);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  serveBoard(fetchMock, {
    boards: Object.fromEntries(MEETINGS.meetings.map((m) => [m.id, board(m.date)])),
    trend: TREND,
    write: () => jsonResponse({}),
  });
  const served = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((url: string, init?: RequestInit) =>
    url.endsWith('/metrics') ? Promise.resolve(jsonResponse(METRICS)) : served(url, init),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function openBoard(auth: { email: string; isAdmin?: boolean }, meetingId: string) {
  await renderWithLanguage(
    <Routes>
      <Route path="/teams/:teamId" element={<BoardPage />} />
      <Route path="/teams/:teamId/metrics" element={<MetricSettingsPage />} />
    </Routes>,
    'en',
    { route: `/teams/${TEAM_ID}?meeting=${meetingId}`, auth },
  );
  await screen.findByRole('heading', { name: 'Revenue' });
}

function recordingControls() {
  return {
    record: screen.queryByRole('button', { name: en.board.record }),
    correct: screen.queryByRole('button', { name: en.board.correct }),
    list: screen.queryByRole('button', { name: en.board.list }),
  };
}

describe('the board offers only what its viewer may do', () => {
  it('lets a member record values, and shows them the settings without controls', async () => {
    // Scenario: A member records values but does not configure metrics.
    const user = userEvent.setup();
    await openBoard({ email: MEMBER }, 'm-2026-10-14');

    expect(recordingControls().record).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: en.board.settingsLink }));

    await screen.findByRole('heading', { name: 'Metrics of Platform' });
    expect(screen.getByRole('listitem')).toHaveTextContent('Green from 95.0 %, amber from 85.0 %');
    for (const name of [
      en.metrics.add,
      en.metrics.copy,
      en.metrics.include,
      /^Edit:/,
      /^Retire:/,
      /^Delete:/,
      /^Change threshold:/,
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('offers recording at a frozen meeting to an administrator only, as a correction', async () => {
    // Scenario: A frozen meeting offers recording only to an administrator.
    const user = userEvent.setup();
    await openBoard({ email: LEADER }, 'm-2026-09-30');

    expect(recordingControls()).toMatchObject({ record: null, correct: null });
    expect(recordingControls().list).toBeInTheDocument();

    cleanup();
    await openBoard({ email: ADMIN, isAdmin: true }, 'm-2026-09-30');

    expect(recordingControls().record).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: en.board.correct }));
    expect(screen.getByLabelText(en.recording.reasonLabel)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Value: Revenue' })).toBeInTheDocument();
  });

  it('offers a stranger only the list of values', async () => {
    await openBoard({ email: 'stranger@example.com' }, 'm-2026-10-14');

    expect(recordingControls()).toMatchObject({ record: null, correct: null });
    expect(recordingControls().list).toBeInTheDocument();
  });
});
