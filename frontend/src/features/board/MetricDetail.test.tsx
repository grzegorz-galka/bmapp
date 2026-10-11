/**
 * The metric detail. One test per scenario of "The metric detail" in
 * specs/metric-values/spec.md, then what it lists beneath the chart.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MetricDetail, trendRows } from './MetricDetail';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import type { MetricTrend } from '../../api/metrics';
import {
  definition,
  jsonResponse,
  LEADER,
  serveBoard,
  TEAM_ID,
  TREND,
  type Fixtures,
} from './boardFixture';

const fetchMock = vi.fn();
let fixtures: Fixtures;

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fixtures = { boards: {}, trend: TREND, write: () => jsonResponse({}) };
  serveBoard(fetchMock, fixtures);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderDetail(onClose = () => {}) {
  await renderWithLanguage(
    <MetricDetail teamId={TEAM_ID} metric={definition()} onClose={onClose} />,
    'en',
  );
  return screen.getByRole('dialog', { name: 'Revenue' });
}

describe('the metric detail', () => {
  it('steps the threshold line at the meeting from which the new version applies', async () => {
    // Scenario: The chart shows a threshold change as a step.
    const dialog = await renderDetail();

    expect(
      await within(dialog).findByRole('img', { name: 'Trend of Revenue' }),
    ).toBeInTheDocument();
    const table = await within(dialog).findByRole('table', { name: en.detail.chartData });
    const rows = within(table).getAllByRole('row').slice(1);
    // The unit follows a no-break space; read it as an ordinary one.
    expect(rows.map((row) => row.textContent?.replace(/\u00a0/g, ' '))).toEqual([
      'Wed, 26 Aug 202691.0 %GreenGreen from 90.0 %, amber from 80.0 %',
      'Wed, 2 Sept 202691.0 %AmberGreen from 95.0 %, amber from 85.0 %',
    ]);
  });

  it('plots each meeting against the boundaries in force on its own date', () => {
    const rows = trendRows(TREND.points);

    expect(rows.map((row) => [row.date, row.value, row.greenLo, row.amberLo])).toEqual([
      ['2026-08-26', 91, 90, 80],
      ['2026-09-02', 91, 95, 85],
    ]);
    expect(rows.every((row) => row.greenHi === null && row.amberHi === null)).toBe(true);
  });

  it('leaves a meeting with no number or no threshold as a gap', () => {
    const [row] = trendRows([
      { ...TREND.points[0]!, value: null, status: 'no_data', threshold: null },
    ]);

    expect(row).toMatchObject({ value: null, greenLo: null, amberLo: null });
  });

  it('lists the recent values with their comments, most recent first', async () => {
    const dialog = await renderDetail();

    const heading = await within(dialog).findByRole('heading', { name: en.detail.recentHeading });
    const list = heading.nextElementSibling as HTMLElement;
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent(`Wed, 2 Sept 2026 91.0 % ${en.status.amber}`);
    expect(items[1]).toHaveTextContent('Ahead of plan');
  });

  it('lists the threshold history and the corrections', async () => {
    const trend: MetricTrend = {
      ...TREND,
      corrections: [
        {
          id: 'c-1',
          meeting_id: 'm-2026-08-26',
          old_value: '12',
          old_manual_status: null,
          old_comment: null,
          new_value: '13',
          new_manual_status: null,
          new_comment: null,
          reason: 'Late invoice booked',
          corrected_by_email: 'admin@example.com',
          corrected_at: '2026-09-10T09:00:00Z',
        },
      ],
    };
    fixtures.trend = trend;
    const dialog = await renderDetail();

    expect(await within(dialog).findByText(/Late invoice booked/)).toHaveTextContent(
      'admin@example.com',
    );
    expect(dialog).toHaveTextContent('Wed, 26 Aug 2026 12.0 % → 13.0 %');
    expect(await within(dialog).findByText(/Effective from Tue, 1 Sept 2026/)).toBeInTheDocument();
    expect(dialog).toHaveTextContent(`Plan · ${LEADER}`);
  });

  it('says when nothing has been corrected', async () => {
    const dialog = await renderDetail();

    expect(await within(dialog).findByText(en.detail.noCorrections)).toBeInTheDocument();
  });

  it('closes from its button, which has the focus when it opens', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const dialog = await renderDetail(onClose);

    const close = within(dialog).getByRole('button', { name: en.detail.close });
    expect(close).toHaveFocus();
    await user.click(close);

    expect(onClose).toHaveBeenCalledOnce();
  });
});
