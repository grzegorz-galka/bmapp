/**
 * The recording view. One test per scenario of "The recording view" in
 * specs/metric-values/spec.md, then how each row saves, the completeness
 * header, and an administrator's correction.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { BoardPage } from './BoardPage';
import { RecordingView } from './RecordingView';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import type { Language } from '../../i18n/languages';
import {
  ADMIN,
  board,
  definition,
  errorResponse,
  jsonResponse,
  MEETINGS,
  MEMBER,
  MONDAY,
  serveBoard,
  TEAM_ID,
  tile,
  TREND,
  writesOf,
  type Fixtures,
} from './boardFixture';

const fetchMock = vi.fn();
let fixtures: Fixtures;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MONDAY);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fixtures = {
    boards: Object.fromEntries(MEETINGS.meetings.map((m) => [m.id, board(m.date)])),
    trend: TREND,
    write: () => jsonResponse({}),
  };
  serveBoard(fetchMock, fixtures);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function openRecording(
  language: Language = 'en',
  auth: { email?: string; isAdmin?: boolean } = { email: MEMBER },
  meetingId = 'm-2026-10-14',
  caption: string = en.board.record,
) {
  const user = userEvent.setup();
  await renderWithLanguage(
    <Routes>
      <Route path="/teams/:teamId" element={<BoardPage />} />
    </Routes>,
    language,
    { route: `/teams/${TEAM_ID}?meeting=${meetingId}`, auth },
  );
  await user.click(await screen.findByRole('button', { name: caption }));
  return user;
}

function lastWrite(): { url: string; body: unknown } {
  const [url, init] = writesOf(fetchMock).at(-1) ?? ['', {}];
  return { url, body: JSON.parse(String(init.body)) };
}

describe('the recording view', () => {
  it('records a number typed in the Polish format, and shows it that way', async () => {
    // Scenario: A number is typed in the Polish format.
    fixtures.boards['m-2026-10-14'] = board('2026-10-14', {
      metrics: [tile({ value: null, status: 'no_data', change: null, improvement: null })],
    });
    const user = await openRecording('pl', { email: MEMBER }, 'm-2026-10-14', pl.board.record);

    const field = screen.getByRole('textbox', { name: 'Wartość: Revenue' });
    await user.type(field, '95,3');
    fixtures.boards['m-2026-10-14'] = board('2026-10-14', {
      metrics: [tile({ value: '95.3', status: 'green' })],
    });
    await user.tab();

    expect(lastWrite()).toEqual({
      url: `/api/teams/${TEAM_ID}/meetings/m-2026-10-14/values/metric-revenue`,
      body: { value: '95.3', manual_status: null, comment: null },
    });
    expect(await screen.findByText(pl.recording.saved)).toBeInTheDocument();
    expect(field).toHaveValue('95,3');
    await user.click(screen.getByRole('button', { name: pl.board.showTiles }));
    const tileItem = (await screen.findByRole('heading', { name: 'Revenue' })).closest('li')!;
    expect(tileItem).toHaveTextContent('95,3 %');
    expect(tileItem).toHaveTextContent(pl.status.green);
  });

  it('shows a frozen meeting read-only to someone who is not an administrator', async () => {
    // Scenario: A frozen meeting is read-only.
    fixtures.boards['m-2026-09-30'] = board('2026-09-30', {
      metrics: [tile({ comment: 'Late invoice' })],
    });
    await openRecording('en', { email: MEMBER }, 'm-2026-09-30', en.board.list);

    const view = screen.getByRole('region', { name: /Values at the meeting on/ });
    expect(within(view).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(view).queryByRole('combobox')).not.toBeInTheDocument();
    expect(view).toHaveTextContent('90.0 %');
    expect(view).toHaveTextContent('Late invoice');
    expect(view).toHaveTextContent(en.recording.readOnly);
  });

  it('heads the list with how complete the recording is, and who is still missing', async () => {
    fixtures.boards['m-2026-10-14'] = board('2026-10-14', {
      completeness: {
        recorded: 12,
        total: 14,
        missing: [
          { metric_id: 'a', name: 'NPS', owner: { id: 'emp-bartek', email: MEMBER } },
          { metric_id: 'b', name: 'OTIF', owner: null },
        ],
      },
    });
    await openRecording();

    expect(screen.getByText('Recorded: 12 of 14')).toBeInTheDocument();
    expect(screen.getByText(`Still missing: NPS (${MEMBER}), OTIF`)).toBeInTheDocument();
  });

  it('shows each metric’s threshold and its number at the previous meeting', async () => {
    await openRecording();

    const view = screen.getByRole('region', { name: /Values at the meeting on/ });
    expect(view).toHaveTextContent('Green from 95.0 %, amber from 85.0 % · Last meeting: 85.0 %');
  });

  it('sends the number, the comment and the colour together', async () => {
    const user = await openRecording();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Colour: Revenue' }), 'red');
    await user.type(screen.getByRole('textbox', { name: 'Comment: Revenue' }), 'Release slipped');
    await user.tab();

    expect(lastWrite().body).toEqual({
      value: '90',
      manual_status: 'red',
      comment: 'Release slipped',
    });
  });

  it('saves nothing when a field is left unchanged', async () => {
    const user = await openRecording();

    await user.click(screen.getByRole('textbox', { name: 'Value: Revenue' }));
    await user.tab();

    expect(writesOf(fetchMock)).toEqual([]);
  });

  it('refuses a number it cannot read without sending it', async () => {
    const user = await openRecording();

    const field = screen.getByRole('textbox', { name: 'Value: Revenue' });
    await user.clear(field);
    await user.type(field, '95,3,1');
    await user.tab();

    expect(writesOf(fetchMock)).toEqual([]);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a number, such as 95.3.');
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows the reason the API gives on the row', async () => {
    fixtures.write = () => errorResponse(422, 'comment', 'metric_value.comment_required');
    const user = await openRecording();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Colour: Revenue' }), 'red');
    await user.tab();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      en.errors['metric_value.comment_required'],
    );
  });

  it('lets an administrator correct a frozen meeting, sending the reason with each save', async () => {
    fixtures.boards['m-2026-09-30'] = board('2026-09-30');
    const user = await openRecording(
      'en',
      { email: ADMIN, isAdmin: true },
      'm-2026-09-30',
      en.board.correct,
    );

    await user.type(screen.getByLabelText(en.recording.reasonLabel), 'Late invoice booked');
    const field = screen.getByRole('textbox', { name: 'Value: Revenue' });
    await user.clear(field);
    await user.type(field, '91');
    await user.tab();

    expect(lastWrite().body).toEqual({
      value: '91',
      manual_status: null,
      comment: null,
      reason: 'Late invoice booked',
    });
  });

  it('lists every active metric the board returns', async () => {
    await renderWithLanguage(
      <RecordingView
        teamId={TEAM_ID}
        mode="edit"
        board={board('2026-10-14', {
          metrics: [
            tile(),
            tile({ metric: definition({ id: 'metric-nps', name: 'NPS', unit: '' }) }),
          ],
        })}
      />,
      'en',
    );

    expect(screen.getByRole('textbox', { name: 'Value: Revenue' })).toHaveValue('90');
    expect(screen.getByRole('textbox', { name: 'Value: NPS' })).toBeInTheDocument();
  });
});
