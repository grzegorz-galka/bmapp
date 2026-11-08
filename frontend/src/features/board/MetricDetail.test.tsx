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
import type {
  DerivationKind,
  DerivedValue,
  MetricDefinition,
  MetricTrend,
} from '../../api/metrics';
import { sameDecimal } from './derivationMessages';
import {
  definition,
  errorResponse,
  jsonResponse,
  LEADER_NAME,
  serveBoard,
  TEAM_ID,
  threshold,
  TREND,
  writesOf,
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

  it('the chart shows the target value', async () => {
    // Scenario: The chart shows the target value.
    const version = (id: string, from: string, target: string, green: string, amber: string) =>
      threshold({
        id,
        effective_from: from,
        target_value: target,
        green_pct: '0',
        amber_pct: '5',
        green_lo: green,
        amber_lo: amber,
      });
    fixtures.trend = {
      ...TREND,
      points: [
        { ...TREND.points[0]!, threshold: version('th-376', '2026-08-01', '376', '376', '357.2') },
        {
          ...TREND.points[1]!,
          threshold: version('th-395', '2026-09-01', '395', '395', '375.25'),
        },
      ],
    };

    expect(
      trendRows(fixtures.trend.points).map((row) => [
        row.date,
        row.target,
        row.greenLo,
        row.amberLo,
      ]),
    ).toEqual([
      ['2026-08-26', 376, 376, 357.2],
      ['2026-09-02', 395, 395, 375.25],
    ]);
    // A version recorded before target values has none to draw.
    expect(trendRows(TREND.points).map((row) => row.target)).toEqual([null, null]);

    const dialog = await renderDetail();
    const table = await within(dialog).findByRole('table', { name: en.detail.chartData });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent?.replace(/\u00a0/g, ' '))).toEqual([
      'Wed, 26 Aug 202691.0 %GreenTarget value 376.0 % · green −0% · amber −5%',
      'Wed, 2 Sept 202691.0 %AmberTarget value 395.0 % · green −0% · amber −5%',
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
          corrected_by_display_name: 'Admin',
          corrected_at: '2026-09-10T09:00:00Z',
        },
      ],
    };
    fixtures.trend = trend;
    const dialog = await renderDetail();

    expect(await within(dialog).findByText(/Late invoice booked/)).toHaveTextContent('Admin');
    expect(dialog).toHaveTextContent('Wed, 26 Aug 2026 12.0 % → 13.0 %');
    expect(await within(dialog).findByText(/Effective from Tue, 1 Sept 2026/)).toBeInTheDocument();
    expect(dialog).toHaveTextContent(`Plan · ${LEADER_NAME}`);
    expect(dialog).not.toHaveTextContent('@');
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

/*
 * "The metric detail lists a derived value's sources", from
 * specs/derived-metrics: a collapsed section for the meeting the board shows,
 * derived again when opened, compared with the recorded number exactly.
 */
describe('the metric detail lists a derived value’s sources', () => {
  const UNITS = ['BPW', 'CKBiR', 'CKI-P', 'CKI-W', 'ODM', 'CKI-S'];
  const NUMBERS = ['90', '97', '87', '83', '105', '101'];
  const PLATFORM = { id: TEAM_ID, name: 'Platform' };
  const SHOWN = { id: 'm-2026-11-04', date: '2026-11-04' };

  function otif(kind: DerivationKind = 'mean') {
    return definition({
      id: 'metric-otif',
      name: 'OTIF E',
      derivation: {
        kind,
        sources: UNITS.map((unit) => ({
          team: PLATFORM,
          metric: { id: `metric-${unit}`, name: `OTIF E: ${unit}` },
          weight: null,
        })),
      },
    });
  }

  function derived(overrides: Partial<DerivedValue> = {}): DerivedValue {
    return {
      value: '93.833333',
      kind: 'mean',
      sources: UNITS.map((unit, index) => ({
        team: PLATFORM,
        metric: { id: `metric-${unit}`, name: `OTIF E: ${unit}` },
        meeting_id: SHOWN.id,
        date: SHOWN.date,
        value: NUMBERS[index]!,
        previous: null,
        weight: null,
      })),
      ...overrides,
    };
  }

  function deriveUrls(): string[] {
    return (fetchMock.mock.calls as [string][])
      .map(([url]) => url)
      .filter((url) => url.endsWith('/derivation'));
  }

  async function renderSources(
    metric: MetricDefinition = otif(),
    recorded: string | null = '93.833333',
    language: Language = 'en',
  ) {
    await renderWithLanguage(
      <MetricDetail
        teamId={TEAM_ID}
        metric={metric}
        onClose={() => {}}
        meeting={SHOWN}
        recorded={recorded}
      />,
      language,
    );
    const dialog = screen.getByRole('dialog', { name: metric.name });
    // The trend has loaded, so anything the detail asks for on opening has been asked.
    await within(dialog).findByRole('img', { name: /OTIF E|Revenue/ });
    return dialog;
  }

  async function openSources(dialog: HTMLElement, heading: string = en.detail.sourcesHeading) {
    const user = userEvent.setup();
    await user.click(within(dialog).getByText(heading));
    return user;
  }

  const text = (element: Element | null) => element?.textContent?.replace(/\u00a0/g, ' ') ?? '';

  function sourceRows(dialog: HTMLElement): string[][] {
    const table = within(dialog).getByRole('table', { name: 'The sources of OTIF E' });
    return within(table)
      .getAllByRole('row')
      .map((row) => Array.from(row.children).map((cell) => text(cell)));
  }

  beforeEach(() => {
    fixtures.derive = () => jsonResponse(derived());
  });

  it('The sources are listed', async () => {
    const dialog = await renderSources();

    await openSources(dialog);

    expect(await within(dialog).findByText(/^Derived:/)).toBeInTheDocument();
    expect(deriveUrls()).toEqual([
      `/api/teams/${TEAM_ID}/meetings/${SHOWN.id}/metrics/metric-otif/derivation`,
    ]);
    expect(sourceRows(dialog)).toEqual([
      ['Team', 'Metric', 'Meeting', 'Number'],
      ...UNITS.map((unit, index) => [
        'Platform',
        `OTIF E: ${unit}`,
        'Wed, 4 Nov 2026',
        NUMBERS[index]!,
      ]),
    ]);
    expect(text(within(dialog).getByText(/^Derived:/))).toBe('Derived: 93.833333 %');
    expect(within(dialog).getByText(/Worked out again/)).toHaveTextContent('Wed, 4 Nov 2026');
    // Nothing is recorded.
    expect(writesOf(fetchMock)).toEqual([]);
  });

  it('lists a weighted mean’s weights', async () => {
    fixtures.derive = () =>
      jsonResponse(
        derived({
          kind: 'weighted_mean',
          value: '90.8',
          sources: derived()
            .sources.slice(0, 3)
            .map((source, index) => ({ ...source, weight: ['3', '1', '0.5'][index]! })),
        }),
      );
    const dialog = await renderSources(otif('weighted_mean'), null, 'pl');

    await openSources(dialog, pl.detail.sourcesHeading);
    await within(dialog).findByText(/^Wyliczono:/);

    const table = within(dialog).getByRole('table', { name: 'Źródła wskaźnika OTIF E' });
    expect(
      within(table)
        .getAllByRole('row')
        .map((row) => text(row.lastElementChild)),
    ).toEqual([pl.detail.sourceWeight, '3', '1', '0,5']);
  });

  it('lists a delta’s previous number and date', async () => {
    fixtures.derive = () =>
      jsonResponse(
        derived({
          kind: 'delta',
          value: '4',
          sources: [
            {
              ...derived().sources[0]!,
              value: '94',
              previous: { meeting_id: 'm-2026-10-28', date: '2026-10-28', value: '90' },
            },
          ],
        }),
      );
    const dialog = await renderSources(otif('delta'), '4');

    await openSources(dialog);
    await within(dialog).findByText(/^Derived:/);

    expect(sourceRows(dialog)).toEqual([
      ['Team', 'Metric', 'Meeting', 'Number', 'Previous'],
      ['Platform', 'OTIF E: BPW', 'Wed, 4 Nov 2026', '94', '90 on Wed, 28 Oct 2026'],
    ]);
  });

  it('Nothing is derived until the section is opened', async () => {
    const dialog = await renderSources();

    expect(within(dialog).getByText(en.detail.sourcesHeading)).toBeInTheDocument();
    expect(within(dialog).queryByRole('table', { name: 'The sources of OTIF E' })).toBeNull();
    expect(deriveUrls()).toEqual([]);

    // Opened, closed and opened again: derived once, the answer kept.
    const user = await openSources(dialog);
    await within(dialog).findByText(/^Derived:/);
    await user.click(within(dialog).getByText(en.detail.sourcesHeading));
    await user.click(within(dialog).getByText(en.detail.sourcesHeading));
    expect(deriveUrls()).toHaveLength(1);
  });

  it('The sources have changed since the value was recorded', async () => {
    fixtures.derive = () =>
      jsonResponse(
        derived({
          value: '94.333333',
          sources: derived().sources.map((source, index) =>
            index === 5 ? { ...source, value: '104' } : source,
          ),
        }),
      );
    const dialog = await renderSources(otif(), '93.833333');

    await openSources(dialog);

    expect(text(await within(dialog).findByText(/^Derived:/))).toBe('Derived: 94.333333 %');
    expect(sourceRows(dialog).at(-1)).toEqual([
      'Platform',
      'OTIF E: CKI-S',
      'Wed, 4 Nov 2026',
      '104',
    ]);
    expect(text(within(dialog).getByText(/have changed/))).toBe(
      'The sources have changed since the value was recorded: 93.833333 % was recorded, they now give 94.333333 %.',
    );
    expect(writesOf(fetchMock)).toEqual([]);
  });

  it('The value matches its sources', async () => {
    // A recorded NUMERIC(21, 6) travels with its six places; a sum is exact.
    fixtures.derive = () => jsonResponse(derived({ kind: 'sum', value: '19.5' }));
    const dialog = await renderSources(otif('sum'), '19.500000');

    await openSources(dialog);

    expect(text(await within(dialog).findByText(/^Derived:/))).toBe('Derived: 19.5 %');
    expect(within(dialog).queryByText(/have changed/)).not.toBeInTheDocument();
  });

  it('No value recorded yet', async () => {
    const dialog = await renderSources(otif(), null);

    await openSources(dialog);

    expect(text(await within(dialog).findByText(/^Derived:/))).toBe('Derived: 93.833333 %');
    expect(sourceRows(dialog)).toHaveLength(1 + UNITS.length);
    expect(within(dialog).queryByText(/have changed/)).not.toBeInTheDocument();
  });

  it('A source is missing now', async () => {
    fixtures.derive = () =>
      errorResponse(409, `sources[${UNITS.indexOf('CKI-S')}]`, 'derivation.source_missing');
    const dialog = await renderSources();

    await openSources(dialog);

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'OTIF E: CKI-S has no number for that week.',
    );
    expect(within(dialog).queryByText(/^Derived:/)).not.toBeInTheDocument();
  });

  it('A metric that is not derived', async () => {
    const dialog = await renderSources(definition(), '91');

    expect(within(dialog).queryByText(en.detail.sourcesHeading)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('group')).not.toBeInTheDocument();
    expect(deriveUrls()).toEqual([]);
  });
});

describe('sameDecimal', () => {
  it('compares decimal strings exactly, never through a float', () => {
    expect(sameDecimal('19.500000', '19.5')).toBe(true);
    expect(sameDecimal('0.000000', '-0')).toBe(true);
    expect(sameDecimal('007', '7.0')).toBe(true);
    expect(sameDecimal('-1.5', '1.5')).toBe(false);
    // Beyond a float's precision: Number would call these equal.
    expect(sameDecimal('123456789012345.000001', '123456789012345.000002')).toBe(false);
  });
});
