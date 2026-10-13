/**
 * The metric detail. One test per scenario of "The metric detail" in
 * specs/metric-values/spec.md, then what it lists beneath the chart: the
 * values grid ("The metric detail's values grid") and that it opens as a
 * modal over the header ("The metric detail is not covered").
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MetricDetail, trendRows } from './MetricDetail';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import type { Language } from '../../i18n/languages';
import { stubDialog } from '../auth/dialogStub';
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

beforeAll(stubDialog);
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

async function renderDetail(onClose = () => {}, metric = definition(), language: Language = 'en') {
  await renderWithLanguage(
    <MetricDetail teamId={TEAM_ID} metric={metric} onClose={onClose} />,
    language,
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

  it('The values are shown as a grid', async () => {
    fixtures.trend = {
      ...TREND,
      points: [
        ...TREND.points,
        {
          ...TREND.points[1]!,
          meeting_id: 'm-2026-10-13',
          date: '2026-10-13',
          value: '95.3',
          status: 'green',
          comment: 'Back on plan',
        },
      ],
    };
    const dialog = await renderDetail(() => {}, definition(), 'pl');

    const grid = await within(dialog).findByRole('table', { name: pl.detail.valuesHeading });
    const header = within(grid)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(header).toEqual([
      pl.detail.date,
      pl.detail.value,
      pl.detail.status,
      pl.detail.commentColumn,
    ]);
    const rows = within(grid)
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.textContent?.replace(/\u00a0/g, ' '));
    // Newest first; the date as ISO in either language, the number in Polish.
    expect(rows).toEqual([
      `2026-10-1395,3 %${pl.status.green}Back on plan`,
      `2026-09-0291,0 %${pl.status.amber}`,
      `2026-08-2691,0 %${pl.status.green}Ahead of plan`,
    ]);
  });

  it('A metric without values', async () => {
    fixtures.trend = {
      ...TREND,
      points: TREND.points.map((point) => ({
        ...point,
        value: null,
        manual_status: null,
        comment: null,
        status: 'no_data' as const,
      })),
    };
    const dialog = await renderDetail();

    expect(await within(dialog).findByText(en.detail.noValues)).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('table', { name: en.detail.valuesHeading }),
    ).not.toBeInTheDocument();
  });

  it('opens as a modal dialog, above the header in the top layer', async () => {
    // Scenario: The header does not cover the detail (the layout half is the e2e flow's).
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    const dialog = await renderDetail();

    expect(dialog.tagName).toBe('DIALOG');
    expect(showModal).toHaveBeenCalledOnce();
    showModal.mockRestore();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    const dialog = await renderDetail(onClose);

    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));

    expect(onClose).toHaveBeenCalledOnce();
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

  it('marks a global metric as global, in words and by a symbol', async () => {
    // Requirement: A global metric is marked as global - in the metric detail.
    const dialog = await renderDetail(() => {}, definition({ scope: 'global' }));

    const mark = within(dialog).getByText(en.metrics.global);
    expect(mark.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    // The mark sits beside the heading, so the dialog is still named by the metric alone.
    expect(within(dialog).getByRole('heading', { level: 2 })).toHaveTextContent(/^Revenue$/);
  });

  it('does not mark a board’s own metric as global', async () => {
    const dialog = await renderDetail();

    expect(within(dialog).queryByText(en.metrics.global)).not.toBeInTheDocument();
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
