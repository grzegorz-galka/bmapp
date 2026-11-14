/**
 * A project's page. One test per scenario of "A project's or product's page"
 * and "The project page uses the bare name" in
 * specs/projects-and-products/spec.md that is about a project.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { ProjectPage } from './ProjectPage';
import { MetricSettingsPage } from '../metrics/MetricSettingsPage';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import type { Metric, MetricTrend, Threshold, TrendPoint } from '../../api/metrics';
import type { Project } from '../../api/projects';
import { jsonResponse, LEADER, MEMBER, TEAM, TEAM_ID } from '../board/boardFixture';

const PROJECT: Project = {
  id: 'prj-42',
  team_id: TEAM_ID,
  code: 'PRJ-042',
  name: 'Billing rewrite',
  manager: { id: 'emp-anna', email: LEADER, display_name: 'Anna Nowak' },
  start_date: '2026-09-01',
  end_date: '2027-03-31',
  active: true,
  past_end: false,
};

const PARENT = { id: PROJECT.id, code: PROJECT.code, name: PROJECT.name, active: true };

const THRESHOLD: Threshold = {
  id: 'th-budget',
  metric_id: 'metric-budget',
  effective_from: '2026-09-01',
  target_value: '100',
  green_pct: '0',
  amber_pct: '10',
  green_lo: null,
  green_hi: '100',
  amber_lo: null,
  amber_hi: '110',
  reason: 'Budget approved',
  recorded_by_email: LEADER,
  recorded_by_display_name: 'Anna Nowak',
  recorded_at: '2026-09-01T08:00:00Z',
};

function metric(overrides: Partial<Metric> = {}): Metric {
  return {
    id: 'metric-budget',
    team_id: TEAM_ID,
    scope: 'board',
    name: 'Budget consumed',
    unit: '%',
    decimals: 0,
    direction: 'lower_is_better',
    group: null,
    position: 0,
    owner: null,
    retired: false,
    retired_in_catalogue: false,
    hidden: true,
    derivation: null,
    project: PARENT,
    product: null,
    threshold: THRESHOLD,
    ...overrides,
  };
}

function point(date: string, value: string | null): TrendPoint {
  return {
    meeting_id: `m-${date}`,
    date,
    value,
    status: value === null ? 'no_data' : 'green',
    set_by_hand: false,
    manual_status: null,
    comment: null,
    threshold: THRESHOLD,
  };
}

const TREND: MetricTrend = {
  metric: metric(),
  points: [
    point('2026-10-07', '40'),
    point('2026-10-14', '55'),
    point('2026-10-21', '71'),
    // The coming meeting, nothing recorded yet.
    point('2026-10-28', null),
  ],
  corrections: [],
};

const fetchMock = vi.fn();
let project: Project;
let metrics: Metric[];

function writes(): [string, RequestInit][] {
  return (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
    (call): call is [string, RequestInit] => (call[1]?.method ?? 'GET') !== 'GET',
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  project = PROJECT;
  metrics = [
    metric(),
    // Another project's metric and one of the board's own: not this page's.
    metric({ id: 'metric-other', project: { ...PARENT, id: 'prj-50', code: 'PRJ-050' } }),
    metric({ id: 'metric-revenue', name: 'Revenue', project: null, hidden: false }),
  ];
  fetchMock.mockImplementation((url: string, init: RequestInit = {}) => {
    if ((init.method ?? 'GET') !== 'GET') {
      const created = metric({
        id: 'metric-scope',
        name: 'Scope change',
        unit: '',
        direction: 'higher_is_better',
        threshold: null,
      });
      metrics = [...metrics, created];
      return Promise.resolve(jsonResponse(created, 201));
    }
    if (url.endsWith('/trend')) {
      return Promise.resolve(
        jsonResponse(url.includes('metric-budget') ? TREND : { ...TREND, points: [] }),
      );
    }
    if (url.endsWith('/thresholds')) return Promise.resolve(jsonResponse([THRESHOLD]));
    if (url.endsWith('/metric-groups')) return Promise.resolve(jsonResponse([]));
    if (url.endsWith('/metrics')) return Promise.resolve(jsonResponse(metrics));
    if (url.endsWith(`/projects/${PROJECT.id}`)) return Promise.resolve(jsonResponse(project));
    return Promise.resolve(jsonResponse(TEAM));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderProject(email = LEADER) {
  await renderWithLanguage(
    <Routes>
      <Route path="/teams/:teamId/projects/:projectId" element={<ProjectPage />} />
    </Routes>,
    'en',
    { route: `/teams/${TEAM_ID}/projects/${PROJECT.id}`, auth: { email } },
  );
  await screen.findByRole('heading', { name: 'PRJ-042 · Billing rewrite', level: 1 });
}

function metricList() {
  return screen.getByRole('list', { name: en.projectsAndProducts.detail.metricsHeading });
}

describe("a project's page", () => {
  it("the page shows a metric's latest value and trend", async () => {
    await renderProject(MEMBER);

    const row = within(metricList()).getByRole('listitem');
    const latest = await within(row).findByRole('group', {
      name: 'Latest value, meeting on Wed, 21 Oct 2026',
    });
    expect(latest).toHaveTextContent('71');
    expect(latest).toHaveTextContent(en.status.green);
    expect(
      within(row).getByRole('img', { name: 'Budget consumed over the last meetings: 4' }),
    ).toBeInTheDocument();
    // The details, with the manager by display name.
    expect(screen.getByText('Anna Nowak')).toBeInTheDocument();
    expect(screen.getByText('Wed, 31 Mar 2027')).toBeInTheDocument();
    expect(screen.getByText(en.projectsAndProducts.common.active)).toBeInTheDocument();
    // A member records on the board; no configuration control.
    expect(
      screen.getByRole('link', { name: en.projectsAndProducts.detail.recordValues }),
    ).toHaveAttribute('href', `/teams/${TEAM_ID}?mode=record`);
    expect(
      screen.queryByRole('button', { name: en.projectsAndProducts.detail.addMetric }),
    ).not.toBeInTheDocument();
  });

  it('a metric is added from the project page', async () => {
    const user = userEvent.setup();
    await renderProject();

    await user.click(screen.getByRole('button', { name: en.projectsAndProducts.detail.addMetric }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(en.metrics.nameLabel), 'Scope change');
    // Offered to show it, but hidden as it arrives; never derived.
    expect(within(dialog).getByRole('switch')).toBeChecked();
    expect(within(dialog).queryByLabelText(en.metrics.derivationKindLabel)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: en.metrics.add }));

    const [url, init] = writes()[0]!;
    expect([url, init.method]).toEqual([`/api/teams/${TEAM_ID}/metrics`, 'POST']);
    expect(JSON.parse(String(init.body))).toMatchObject({
      name: 'Scope change',
      project_id: PROJECT.id,
      hidden: true,
    });
    expect(JSON.parse(String(init.body))).not.toHaveProperty('derivation');
    const row = (await within(metricList()).findByText('Scope change')).closest('li')!;
    expect(row).toHaveTextContent(en.projectsAndProducts.common.notOnBoard);

    // The board's settings page lists it labelled with the project, marked hidden.
    cleanup();
    await renderWithLanguage(
      <Routes>
        <Route path="/teams/:teamId/metrics" element={<MetricSettingsPage />} />
      </Routes>,
      'en',
      { route: `/teams/${TEAM_ID}/metrics`, auth: { email: LEADER } },
    );
    const settingsRow = (await screen.findByText('PRJ-042 · Scope change')).closest('li')!;
    expect(settingsRow).toHaveTextContent(en.metrics.hiddenMark);
  });

  it('the project page uses the bare name', async () => {
    await renderProject();

    const items = within(metricList()).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Budget consumed');
    expect(items[0]).not.toHaveTextContent('PRJ-042');
    expect(within(items[0]!).getByRole('button', { name: 'Edit: Budget consumed' })).toBeVisible();
  });

  it("an inactive project's page", async () => {
    project = { ...PROJECT, active: false };
    metrics = [metric({ retired: true, project: { ...PARENT, active: false } })];
    await renderProject();

    expect(screen.getByText(en.projectsAndProducts.common.inactive)).toBeInTheDocument();
    expect(screen.getByText(en.projectsAndProducts.detail.projectInactiveNote)).toBeInTheDocument();
    // History stays: the latest value and the trend.
    const row = within(metricList()).getByRole('listitem');
    await waitFor(() => expect(row).toHaveTextContent('71'));
    expect(
      within(row).getByRole('img', { name: 'Budget consumed over the last meetings: 4' }),
    ).toBeInTheDocument();
    // No way to record a value, and no switch that would mean nothing while inactive.
    expect(
      screen.queryByRole('link', { name: en.projectsAndProducts.detail.recordValues }),
    ).not.toBeInTheDocument();
    expect(within(row).queryByRole('switch')).not.toBeInTheDocument();
    expect(
      within(row).queryByRole('button', { name: /^Retire|^Bring back/ }),
    ).not.toBeInTheDocument();
  });
});
