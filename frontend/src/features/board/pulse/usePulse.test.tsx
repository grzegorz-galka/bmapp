/**
 * Saving one's own answer refetches the results, so the count, the average
 * and the answers table - which only the server computes - follow.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLanguage } from '../../../test/render';
import { usePulse, useSavePulseAnswer } from './usePulse';
import type { PulseResults } from '../../../api/pulse';

const TEAM_ID = 'team-1';
const MEETING_ID = 'm-1';
const PATH = `/api/teams/${TEAM_ID}/meetings/${MEETING_ID}/pulse`;

let results: PulseResults;

function Probe() {
  const pulse = usePulse(TEAM_ID, MEETING_ID);
  const save = useSavePulseAnswer(TEAM_ID, MEETING_ID);
  return (
    <>
      <p>answered: {pulse.data?.answered ?? 'none'}</p>
      <p>average: {pulse.data?.average ?? 'none'}</p>
      <button
        type="button"
        onClick={() => save.mutate({ rating: 4, positive: 'Release', negative: '', better: '' })}
      >
        save
      </button>
    </>
  );
}

const fetchMock = vi.fn();

const empty: PulseResults = {
  meeting_id: MEETING_ID,
  editable: true,
  answered: 0,
  members: 3,
  average: null,
  status: 'no_data',
  previous: null,
  change: null,
  distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
  trend: [],
  answers: [],
  missing: [],
  missing_count: 3,
  own: null,
};

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  results = empty;
  fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      const answer = {
        employee_id: 'e-1',
        email: 'ala@pse.pl',
        rating: 4,
        status: 'green',
        positive: 'Release',
        negative: '',
        better: '',
        updated_at: '2026-10-14T11:30:00Z',
      } as const;
      // What the server would now say: one answer, averaging 4.
      results = {
        ...empty,
        answered: 1,
        average: '4.00',
        status: 'green',
        distribution: { ...empty.distribution, '4': 1 },
        answers: [answer],
        missing_count: 2,
        own: answer,
      };
      return Promise.resolve({ ok: true, status: 200, json: async () => answer } as Response);
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => results } as Response);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function calls(method: string, url: string) {
  return (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
    ([called, init]) => called === url && (init?.method ?? 'GET') === method,
  );
}

describe('the pulse hooks', () => {
  it('refetch the results after the own answer is saved', async () => {
    await renderWithLanguage(<Probe />, 'en');
    await screen.findByText('answered: 0');

    await userEvent.click(screen.getByRole('button', { name: 'save' }));

    await screen.findByText('answered: 1');
    expect(screen.getByText('average: 4.00')).toBeInTheDocument();
    expect(calls('GET', PATH)).toHaveLength(2);
    const [sent] = calls('PUT', `${PATH}/me`);
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({
      rating: 4,
      positive: 'Release',
      negative: '',
      better: '',
    });
  });
});
