/**
 * The pulse check view on the board. One test per scenario of "The pulse check
 * view", "Names can be hidden for screen sharing" and "The answer form" in
 * specs/pulse-check/spec.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { BoardPage } from '../BoardPage';
import { renderWithLanguage } from '../../../test/render';
import { en } from '../../../i18n/en';
import { pl } from '../../../i18n/pl';
import type { Language } from '../../../i18n/languages';
import type { PulseAnswerWrite } from '../../../api/pulse';
import {
  board,
  errorResponse,
  jsonResponse,
  MEETINGS,
  MEMBER,
  MONDAY,
  noPulse,
  pulseAnswer,
  pulseResults,
  serveBoard,
  SEVEN_ANSWERS,
  TEAM_ID,
  TREND,
  writesOf,
  type Fixtures,
} from '../boardFixture';

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
    pulse: { 'm-2026-10-14': pulseResults('m-2026-10-14') },
    write: () => jsonResponse({}),
  };
  serveBoard(fetchMock, fixtures);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function Address() {
  const location = useLocation();
  return <output data-testid="address">{location.search}</output>;
}

async function renderBoard(
  query = '',
  language: Language = 'en',
  auth: { email?: string; isAdmin?: boolean } = { email: MEMBER },
) {
  await renderWithLanguage(
    <Routes>
      <Route
        path="/teams/:teamId"
        element={
          <>
            <BoardPage />
            <Address />
          </>
        }
      />
    </Routes>,
    language,
    { route: `/teams/${TEAM_ID}${query}`, auth },
  );
  const catalogue = language === 'en' ? en : pl;
  await screen.findByRole('heading', {
    name: catalogue.board.heading.replace('{{name}}', 'Platform'),
  });
}

function address(): URLSearchParams {
  return new URLSearchParams(screen.getByTestId('address').textContent ?? '');
}

function meetingShown(): string {
  return (screen.getByLabelText(en.board.meetingSelectLabel) as HTMLSelectElement).value;
}

const SWITCH_7_OF_11 = 'Pulse check 7/11';

async function openPulse() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: SWITCH_7_OF_11 }));
  await screen.findByRole('heading', { name: en.pulse.answeredLabel });
  return user;
}

describe('the pulse check view', () => {
  it('The view has its own address', async () => {
    fixtures.pulse!['m-2026-10-07'] = pulseResults('m-2026-10-07');
    await renderBoard('?meeting=m-2026-10-07');
    await openPulse();

    expect(address().get('view')).toBe('pulse');
    expect(address().get('meeting')).toBe('m-2026-10-07');

    // Reloading the address lands on the same view of the same meeting.
    const reloaded = `?${address().toString()}`;
    cleanup();
    await renderBoard(reloaded);

    expect(await screen.findByText('7 of 11')).toBeInTheDocument();
    expect(meetingShown()).toBe('m-2026-10-07');
    expect(screen.queryByRole('heading', { name: 'Revenue' })).not.toBeInTheDocument();
  });

  it('keeps the view when moving between meetings, and the meeting when switching views', async () => {
    await renderBoard();
    const user = await openPulse();

    await user.click(screen.getByRole('button', { name: `${en.board.nextMeeting} →` }));
    await waitFor(() => expect(address().get('meeting')).toBe('m-2026-10-21'));
    expect(address().get('view')).toBe('pulse');
    expect(await screen.findByText(en.pulse.empty)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: en.pulse.metricsView }));
    expect(address().get('meeting')).toBe('m-2026-10-21');
    expect(address().get('view')).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Revenue' })).toBeInTheDocument();
  });

  it('The view’s entry shows how many have answered', async () => {
    await renderBoard();

    expect(await screen.findByRole('heading', { name: 'Revenue' })).toBeInTheDocument();
    const entry = await screen.findByRole('button', { name: SWITCH_7_OF_11 });
    expect(entry).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: en.pulse.metricsView })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('The results are shown as cards, a trend and a table', async () => {
    await renderBoard();
    await openPulse();

    const answered = screen.getByRole('region', { name: en.pulse.answeredLabel });
    expect(answered).toHaveTextContent('7 of 11');
    expect(answered).toHaveTextContent(
      'Missing: hania@example.com, igor@example.com, jan@example.com, kasia@example.com',
    );

    const average = screen.getByRole('region', { name: en.pulse.questionRating });
    expect(within(average).getByRole('img', { name: 'Average rating: 3.6 of 5' })).toBeVisible();
    expect(average).toHaveTextContent('-0.2 vs 7 Oct');

    const distribution = screen.getByRole('region', { name: en.pulse.distributionTitle });
    expect(
      within(distribution)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['5 – Very good1', '4 – Good3', '3 – Neutral2', '2 – Rather bad1', '1 – Very bad0']);

    const trend = screen.getByRole('region', { name: en.pulse.trendTitle });
    expect(within(trend).getByRole('img', { name: en.pulse.trendLabel })).toBeInTheDocument();
    const trendTable = within(trend).getByRole('table', { name: en.pulse.trendTitle });
    expect(
      within(trendTable)
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent),
    ).toEqual(['Wed, 7 Oct 20263.8010', 'Wed, 14 Oct 20263.577']);

    const answers = screen.getByRole('region', { name: en.pulse.answersHeading });
    const rows = within(answers).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(7);
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual(
      SEVEN_ANSWERS.map((answer) => answer.email),
    );
    expect(rows[0]).toHaveTextContent('ala@example.com positive');
  });

  it('Colour is never the only signal', async () => {
    await renderBoard();
    await openPulse();

    const average = screen.getByRole('region', { name: en.pulse.questionRating });
    expect(average).toHaveTextContent(en.pulse.rating3);
    const ratings = within(screen.getByRole('region', { name: en.pulse.answersHeading }))
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelectorAll('td')[0]?.textContent?.trim());
    expect(ratings).toEqual([
      '5 – Very good',
      '4 – Good',
      '4 – Good',
      '4 – Good',
      '3 – Neutral',
      '3 – Neutral',
      '2 – Rather bad',
    ]);
  });

  it('The average is shown in the active language’s format', async () => {
    await renderBoard('?view=pulse', 'pl');

    const gauge = await screen.findByRole('img', { name: 'Średnia ocena: 3,6 z 5' });
    expect(gauge).toHaveTextContent('3,6');
    expect(screen.getByText('7 z 11')).toBeInTheDocument();
  });

  it('shows a rising average with a plus and an arrow up', async () => {
    fixtures.pulse!['m-2026-10-14'] = pulseResults('m-2026-10-14', { change: '0.23' });
    await renderBoard('?view=pulse');

    expect(await screen.findByText(/\+0\.2 vs 7 Oct/)).toHaveTextContent('▲ +0.2 vs 7 Oct');
  });

  it('says the trend appears after the second meeting with answers', async () => {
    fixtures.pulse!['m-2026-10-14'] = pulseResults('m-2026-10-14', {
      trend: [
        {
          meeting_id: 'm-2026-10-14',
          date: '2026-10-14',
          average: '3.57',
          status: 'amber',
          answered: 7,
        },
      ],
      previous: null,
      change: null,
    });
    await renderBoard('?view=pulse');

    expect(await screen.findByText(en.pulse.trendPending)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: en.pulse.trendLabel })).not.toBeInTheDocument();
  });

  it('Names are hidden', async () => {
    await renderBoard();
    const user = await openPulse();

    await user.click(screen.getByRole('checkbox', { name: en.pulse.hideNames }));

    const rows = within(screen.getByRole('region', { name: en.pulse.answersHeading }))
      .getAllByRole('row')
      .slice(1);
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual(
      [1, 2, 3, 4, 5, 6, 7].map((n) => `Person ${n}`),
    );
    expect(screen.getByRole('region', { name: en.pulse.answeredLabel })).toHaveTextContent(
      'Answers missing: 4',
    );
    expect(screen.queryByText(/@example\.com$/)).not.toBeInTheDocument();
  });

  it('Nobody has answered yet', async () => {
    fixtures.pulse!['m-2026-10-14'] = noPulse('m-2026-10-14');
    const user = userEvent.setup();
    await renderBoard('?view=pulse');

    expect(await screen.findByText(en.pulse.empty)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: en.pulse.answersHeading })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: en.pulse.answerFirst }));

    expect(screen.getByRole('radio', { name: '4 – Good' })).toBeInTheDocument();
  });
});

describe('the answer form', () => {
  it('A member answers through the form', async () => {
    fixtures.pulse!['m-2026-10-14'] = noPulse('m-2026-10-14');
    fixtures.write = (_url, init) => {
      const body = JSON.parse(String(init.body)) as PulseAnswerWrite;
      const answer = pulseAnswer(MEMBER, body.rating, { ...body });
      fixtures.pulse!['m-2026-10-14'] = noPulse('m-2026-10-14', {
        answered: 1,
        average: '4.00',
        status: 'green',
        distribution: { '1': 0, '2': 0, '3': 0, '4': 1, '5': 0 },
        answers: [answer],
        missing: [],
        missing_count: 1,
        own: answer,
      });
      return jsonResponse(answer);
    };
    const user = userEvent.setup();
    await renderBoard('?view=pulse');
    await user.click(await screen.findByRole('button', { name: en.pulse.yourAnswer }));

    expect(
      screen.getByRole('heading', { name: /Your answer for the meeting on/ }),
    ).toHaveTextContent('Wed, 14 Oct 2026');
    await user.click(screen.getByRole('radio', { name: '4 – Good' }));
    await user.type(
      screen.getByRole('textbox', { name: en.pulse.questionPositive }),
      'Release went out',
    );
    await user.click(screen.getByRole('button', { name: en.pulse.save }));

    const [[url, init]] = writesOf(fetchMock) as [[string, RequestInit]];
    expect(url).toBe(`/api/teams/${TEAM_ID}/meetings/m-2026-10-14/pulse/me`);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({
      rating: 4,
      positive: 'Release went out',
      negative: '',
      better: '',
    });
    const answered = await screen.findByRole('region', { name: en.pulse.answeredLabel });
    await waitFor(() => expect(answered).toHaveTextContent('1 of 2'));
    expect(screen.getByRole('button', { name: 'Pulse check 1/2' })).toBeInTheDocument();
  });

  it('The form shows an existing answer for changing', async () => {
    const own = pulseAnswer(MEMBER, 4, {
      positive: 'Release went out',
      negative: 'Night call',
      better: '',
    });
    fixtures.pulse!['m-2026-10-14'] = pulseResults('m-2026-10-14', { own });
    fixtures.write = () => jsonResponse({ ...own, rating: 2 });
    const user = userEvent.setup();
    await renderBoard('?view=pulse');
    await user.click(await screen.findByRole('button', { name: en.pulse.yourAnswer }));

    expect(screen.getByRole('radio', { name: '4 – Good' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: en.pulse.questionPositive })).toHaveValue(
      'Release went out',
    );
    expect(screen.getByRole('textbox', { name: en.pulse.questionNegative })).toHaveValue(
      'Night call',
    );
    expect(screen.getByText(en.pulse.hasAnswer)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '2 – Rather bad' }));
    await user.click(screen.getByRole('button', { name: en.pulse.update }));

    const [[, init]] = writesOf(fetchMock) as [[string, RequestInit]];
    expect(JSON.parse(String(init.body))).toEqual({
      rating: 2,
      positive: 'Release went out',
      negative: 'Night call',
      better: '',
    });
    expect(await screen.findByRole('region', { name: en.pulse.answeredLabel })).toBeInTheDocument();
  });

  it('A frozen meeting has no form', async () => {
    fixtures.pulse!['m-2026-09-30'] = pulseResults('m-2026-09-30', {
      own: pulseAnswer(MEMBER, 4),
    });
    await renderBoard('?view=pulse&meeting=m-2026-09-30');

    expect(await screen.findByText('7 of 11')).toBeInTheDocument();
    expect(screen.getByText(en.pulse.frozen)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en.pulse.yourAnswer })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('asks for a rating before saving', async () => {
    const user = userEvent.setup();
    await renderBoard('?view=pulse');
    await user.click(await screen.findByRole('button', { name: en.pulse.yourAnswer }));
    await user.click(screen.getByRole('button', { name: en.pulse.save }));

    expect(screen.getByRole('alert')).toHaveTextContent(en.errors['pulse_rating.out_of_range']);
    expect(writesOf(fetchMock)).toEqual([]);
  });

  it('shows a refused text under its own field, and a frozen meeting as a message', async () => {
    fixtures.write = () => errorResponse(422, 'positive', 'pulse_text.too_long');
    const user = userEvent.setup();
    await renderBoard('?view=pulse');
    await user.click(await screen.findByRole('button', { name: en.pulse.yourAnswer }));
    await user.click(screen.getByRole('radio', { name: '5 – Very good' }));
    await user.click(screen.getByRole('button', { name: en.pulse.save }));

    const positive = screen.getByRole('textbox', { name: en.pulse.questionPositive });
    await waitFor(() => expect(positive).toHaveAttribute('aria-invalid', 'true'));
    expect(positive).toHaveAccessibleDescription(en.errors['pulse_text.too_long']);

    fixtures.write = () => errorResponse(409, null, 'pulse_answer.meeting_frozen');
    await user.click(screen.getByRole('button', { name: en.pulse.save }));
    expect(await screen.findByText(en.errors['pulse_answer.meeting_frozen'])).toBeInTheDocument();
  });
});
