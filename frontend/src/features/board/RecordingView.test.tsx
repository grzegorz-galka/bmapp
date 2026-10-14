/**
 * The recording view. One test per scenario of "The recording view" in
 * specs/metric-values/spec.md, then how each row saves, the completeness
 * header, and an administrator's correction.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { BoardPage } from './BoardPage';
import { RecordingView } from './RecordingView';
import styles from './board.module.css';
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

/** A metric's status list. */
function statusList(metric: string): HTMLSelectElement {
  return screen.getByRole('combobox', { name: `Status: ${metric}` });
}

/** Chooses one option of a metric's status list by its caption. */
async function chooseStatus(user: UserEvent, metric: string, option: string) {
  await user.selectOptions(
    statusList(metric),
    within(statusList(metric)).getByRole('option', { name: option }),
  );
}

/** The caption of the option a metric's status list shows as chosen. */
function chosenStatus(metric: string): string | undefined {
  const list = statusList(metric);
  return list.selectedOptions[0]?.textContent ?? undefined;
}

function lastWrite(): { url: string; body: unknown } {
  const [url, init] = writesOf(fetchMock).at(-1) ?? ['', {}];
  return { url, body: JSON.parse(String(init.body)) };
}

describe('the recording view has its own address', () => {
  async function openAt(query: string) {
    await renderWithLanguage(
      <Routes>
        <Route path="/teams/:teamId" element={<BoardPage />} />
      </Routes>,
      'en',
      { route: `/teams/${TEAM_ID}${query}`, auth: { email: MEMBER } },
    );
    // The board's first render is the slow one under a full run, as in the item tests.
    return screen.findByRole('region', { name: /Values at the meeting on/ }, { timeout: 5000 });
  }

  it('The recording view is opened from its address', async () => {
    // Monday the 12th: next Wednesday's meeting is the 14th.
    const view = await openAt('?meeting=m-2026-10-14&mode=record');

    expect((screen.getByLabelText(en.board.meetingSelectLabel) as HTMLSelectElement).value).toBe(
      'm-2026-10-14',
    );
    expect(within(view).getByRole('textbox', { name: 'Value: Revenue' })).toBeEnabled();
  });

  it('opens the recording view of a frozen meeting read-only from its address', async () => {
    const view = await openAt('?meeting=m-2026-09-30&mode=record');

    expect(within(view).queryByRole('textbox')).not.toBeInTheDocument();
    expect(view).toHaveTextContent(en.recording.readOnly);
  });
});

describe('the recording view', () => {
  it('A number is typed in the Polish format', async () => {
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

  it('A frozen meeting is read-only', async () => {
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

  it('The fields line up in columns', async () => {
    await renderWithLanguage(
      <RecordingView
        teamId={TEAM_ID}
        mode="edit"
        board={board('2026-10-14', {
          metrics: [
            tile(),
            tile({
              metric: definition({
                id: 'metric-lead',
                name: 'Lead time from commit to production',
                unit: 'working days',
              }),
            }),
          ],
        })}
      />,
      'en',
    );

    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([
      en.recording.metricColumn,
      en.recording.value,
      en.recording.status,
      en.recording.comment,
      en.recording.stateColumn,
    ]);
    for (const name of ['Revenue', 'Lead time from commit to production']) {
      const row = within(table).getByRole('row', { name: new RegExp(name) });
      const cells = within(row).getAllByRole('cell');
      expect(
        within(cells[0]!).getByRole('textbox', { name: `Value: ${name}` }),
      ).toBeInTheDocument();
      expect(
        within(cells[1]!).getByRole('combobox', { name: `Status: ${name}` }),
      ).toBeInTheDocument();
      expect(
        within(cells[2]!).getByRole('textbox', { name: `Comment: ${name}` }),
      ).toBeInTheDocument();
    }
  });

  it('Each field is named after its metric', async () => {
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
      'pl',
    );

    for (const name of ['Revenue', 'NPS']) {
      expect(screen.getByRole('textbox', { name: `Wartość: ${name}` })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: `Status: ${name}` })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: `Komentarz: ${name}` })).toBeInTheDocument();
    }
    // The bare captions appear once, as column headers, not on every row.
    for (const caption of [pl.recording.value, pl.recording.comment]) {
      expect(screen.getAllByText(caption, { exact: true })).toHaveLength(1);
      expect(screen.queryByLabelText(caption, { exact: true })).not.toBeInTheDocument();
    }
  });

  it('A frozen meeting uses the same columns', async () => {
    await renderWithLanguage(
      <RecordingView
        teamId={TEAM_ID}
        mode="readOnly"
        board={board('2026-09-30', { metrics: [tile({ comment: 'Late invoice' })] })}
      />,
      'en',
    );

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader')).toHaveLength(5);
    const row = within(table).getByRole('row', { name: /Revenue/ });
    const cells = within(row).getAllByRole('cell');
    expect(cells).toHaveLength(4);
    expect(cells[0]).toHaveTextContent('90.0 %');
    expect(cells[1]).toHaveTextContent(en.status.amber);
    expect(cells[2]).toHaveTextContent('Late invoice');
    expect(within(table).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('A narrow screen stacks each metric', async () => {
    await renderWithLanguage(
      <RecordingView teamId={TEAM_ID} mode="edit" board={board('2026-10-14')} />,
      'pl',
    );

    const row = within(screen.getByRole('table')).getByRole('row', { name: /Revenue/ });
    expect(within(row).getByRole('rowheader')).toHaveAttribute(
      'data-label',
      pl.recording.metricColumn,
    );
    expect(
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.dataset.label),
    ).toEqual([
      pl.recording.value,
      pl.recording.status,
      pl.recording.comment,
      pl.recording.stateColumn,
    ]);
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

    await chooseStatus(user, 'Revenue', en.status.red);
    await user.type(screen.getByRole('textbox', { name: 'Comment: Revenue' }), 'Release slipped');
    await user.tab();

    expect(lastWrite().body).toEqual({
      value: '90',
      manual_status: 'red',
      comment: 'Release slipped',
    });
  });

  it('A status is set by hand with the toggle', async () => {
    const user = await openRecording();

    await chooseStatus(user, 'Revenue', en.status.red);
    await user.type(screen.getByRole('textbox', { name: 'Comment: Revenue' }), 'Release slipped');
    await user.tab();

    expect(lastWrite().body).toEqual({
      value: '90',
      manual_status: 'red',
      comment: 'Release slipped',
    });
    expect(statusList('Revenue')).toHaveValue('red');
    expect(chosenStatus('Revenue')).toBe(en.status.red);
    expect(screen.getByRole('columnheader', { name: en.recording.status })).toBeInTheDocument();
  });

  it('The list defaults to Automatic', async () => {
    await openRecording();

    expect(statusList('Revenue')).toHaveValue('');
    expect(chosenStatus('Revenue')).toBe(en.recording.automatic);
    expect(
      within(statusList('Revenue'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([en.recording.automatic, en.status.green, en.status.amber, en.status.red]);
  });

  it('The colours are shown in colour', async () => {
    // The class names are what a test can see; contrast.test.ts holds each
    // colour to 4.5:1 in both themes.
    fixtures.boards['m-2026-10-14'] = board('2026-10-14', {
      metrics: [tile({ manual_status: 'amber', set_by_hand: true, comment: 'Close call' })],
    });
    await openRecording();

    const list = statusList('Revenue');
    const option = (name: string) => within(list).getByRole('option', { name });
    expect(option(en.recording.automatic)).toHaveClass(styles.statusAutomatic!);
    expect(option(en.status.green)).toHaveClass(styles.statusGreen!);
    expect(option(en.status.amber)).toHaveClass(styles.statusAmber!);
    expect(option(en.status.red)).toHaveClass(styles.statusRed!);
    expect(list).toHaveValue('amber');
    expect(list).toHaveClass(styles.statusAmber!);
    expect(list).not.toHaveClass(styles.statusAutomatic!);
  });

  it('Automatic clears a status set by hand', async () => {
    fixtures.boards['m-2026-10-14'] = board('2026-10-14', {
      metrics: [tile({ manual_status: 'red', set_by_hand: true, comment: 'Release slipped' })],
    });
    const user = await openRecording();
    expect(statusList('Revenue')).toHaveValue('red');

    await chooseStatus(user, 'Revenue', en.recording.automatic);
    await user.tab();

    expect(lastWrite().body).toEqual({
      value: '90',
      manual_status: null,
      comment: 'Release slipped',
    });
    expect(statusList('Revenue')).toHaveClass(styles.statusAutomatic!);
  });

  it('The number field fits ten characters', async () => {
    await openRecording();

    expect(screen.getByRole('textbox', { name: 'Value: Revenue' })).toHaveAttribute('size', '10');
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

    await chooseStatus(user, 'Revenue', en.status.red);
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
