/**
 * The metric settings page: adding, editing, retiring and deleting metrics,
 * recording a threshold version, and what a member who may not configure the
 * board sees.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { MetricSettingsPage } from './MetricSettingsPage';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import type { Language } from '../../i18n/languages';
import type { Metric, Threshold } from '../../api/metrics';
import type { GlobalMetric } from '../../api/globalMetrics';
import type { Team, TeamDetail } from '../../api/teams';

const TEAM_ID = 'team-1';
const LEADER = 'anna@example.com';
const MEMBER = 'bartek@example.com';

const TEAM: TeamDetail = {
  id: TEAM_ID,
  name: 'Platform',
  board: { id: 'board-1', name: 'Platform', schedule: null },
  members: [
    { employee_id: 'emp-anna', email: LEADER, is_leader: true },
    { employee_id: 'emp-bartek', email: MEMBER, is_leader: false },
  ],
};

const THRESHOLD: Threshold = {
  id: 'th-1',
  metric_id: 'metric-revenue',
  effective_from: '2026-10-01',
  green_lo: '95',
  green_hi: null,
  amber_lo: '85',
  amber_hi: null,
  reason: 'Plan for Q4',
  recorded_by_email: LEADER,
  recorded_at: '2026-10-01T08:00:00Z',
};

function metric(overrides: Partial<Metric> = {}): Metric {
  return {
    id: 'metric-revenue',
    team_id: TEAM_ID,
    scope: 'board',
    name: 'Revenue',
    unit: 'mln zł',
    decimals: 1,
    direction: 'higher_is_better',
    group_label: 'Finance',
    position: 1,
    owner: null,
    retired: false,
    retired_in_catalogue: false,
    threshold: THRESHOLD,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function errorResponse(status: number, field: string | null, code: string) {
  return jsonResponse({ errors: [{ field, code, message: 'developer text' }] }, status);
}

const fetchMock = vi.fn();
let metrics: Metric[];

/** Reads answer from the fixtures; writes answer with `write`, or succeed. */
function serve(write: (url: string, init: RequestInit) => Response | undefined = () => undefined) {
  fetchMock.mockImplementation((url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    if (method !== 'GET') {
      return Promise.resolve(write(url, init) ?? jsonResponse(metrics[0], 200));
    }
    if (url.endsWith('/thresholds')) return Promise.resolve(jsonResponse([THRESHOLD]));
    if (url.endsWith('/metrics')) return Promise.resolve(jsonResponse(metrics));
    return Promise.resolve(jsonResponse(TEAM));
  });
}

function writes(): [string, RequestInit][] {
  const calls = fetchMock.mock.calls as [string, RequestInit | undefined][];
  return calls.filter(
    (call): call is [string, RequestInit] =>
      call[1]?.method !== undefined && call[1].method !== 'GET',
  );
}

function lastBody(): unknown {
  const [, init] = writes().at(-1) ?? [];
  return JSON.parse(String(init?.body));
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  metrics = [metric()];
  serve();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderSettings(
  language: Language = 'en',
  auth: { email?: string; isAdmin?: boolean } = { email: LEADER },
) {
  await renderWithLanguage(
    <Routes>
      <Route path="/teams/:teamId/metrics" element={<MetricSettingsPage />} />
    </Routes>,
    language,
    { route: `/teams/${TEAM_ID}/metrics`, auth },
  );
  const catalogue = language === 'en' ? en : pl;
  await screen.findByRole('heading', {
    name: catalogue.metrics.heading.replace('{{name}}', 'Platform'),
  });
}

describe('the metric settings page', () => {
  it('lists each metric with its direction, unit, group and the threshold in force', async () => {
    await renderSettings();

    const row = within(screen.getByRole('list', { name: en.metrics.listLabel })).getByRole(
      'listitem',
    );
    expect(row).toHaveTextContent('Revenue');
    expect(row).toHaveTextContent(en.direction.higher_is_better);
    expect(row).toHaveTextContent('Group: Finance');
    expect(row).toHaveTextContent('Green from 95.0 mln zł, amber from 85.0 mln zł');
  });

  it('reads in Polish, numbers included', async () => {
    await renderSettings('pl');

    expect(screen.getByRole('listitem')).toHaveTextContent(
      'Zielony od 95,0 mln zł, żółty od 85,0 mln zł',
    );
    expect(screen.getByRole('button', { name: pl.metrics.create })).toBeInTheDocument();
  });

  it('The three ways to add a metric are offered at the top', async () => {
    await renderSettings();

    const create = screen.getByRole('button', { name: en.metrics.create });
    const copy = screen.getByRole('button', { name: en.metrics.copy });
    const include = screen.getByRole('button', { name: en.metrics.include });
    // One row, in this order, above the list of metrics.
    expect(create.parentElement).toBe(copy.parentElement);
    expect(copy.parentElement).toBe(include.parentElement);
    expect([...create.parentElement!.children]).toEqual([create, copy, include]);
    const list = screen.getByRole('list', { name: en.metrics.listLabel });
    expect(create.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByLabelText(en.metrics.nameLabel)).not.toBeInTheDocument();
    for (const name of [en.teams.boardLink, en.board.meetingsLink]) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
  });

  it('A metric is created from the dialog', async () => {
    const user = userEvent.setup();
    await renderSettings();

    await user.click(screen.getByRole('button', { name: en.metrics.create }));
    const dialog = within(screen.getByRole('dialog', { name: en.metrics.create }));
    await user.type(dialog.getByLabelText(en.metrics.nameLabel), 'Open bugs');
    await user.type(dialog.getByLabelText(en.metrics.unitLabel), 'pcs');
    await user.selectOptions(dialog.getByLabelText(en.metrics.directionLabel), 'lower_is_better');
    await user.type(dialog.getByLabelText(en.metrics.groupLabel), 'Quality');
    await user.selectOptions(dialog.getByLabelText(en.metrics.ownerLabel), 'emp-bartek');
    await user.click(dialog.getByRole('button', { name: en.metrics.add }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes()[0]?.[0]).toBe(`/api/teams/${TEAM_ID}/metrics`);
    expect(lastBody()).toEqual({
      name: 'Open bugs',
      unit: 'pcs',
      decimals: 0,
      direction: 'lower_is_better',
      group_label: 'Quality',
      position: 0,
      owner_employee_id: 'emp-bartek',
    });
  });

  it('A rejection keeps the dialog open', async () => {
    serve(() => errorResponse(409, 'name', 'metric_name.duplicate'));
    const user = userEvent.setup();
    await renderSettings();

    await user.click(screen.getByRole('button', { name: en.metrics.create }));
    const dialog = within(screen.getByRole('dialog', { name: en.metrics.create }));
    await user.type(dialog.getByLabelText(en.metrics.nameLabel), 'revenue');
    await user.click(dialog.getByRole('button', { name: en.metrics.add }));

    expect(await dialog.findByRole('alert')).toHaveTextContent(en.errors['metric_name.duplicate']);
    expect(dialog.getByLabelText(en.metrics.nameLabel)).toHaveValue('revenue');
  });

  it('Cancelling leaves the board unchanged', async () => {
    const user = userEvent.setup();
    await renderSettings();

    await user.click(screen.getByRole('button', { name: en.metrics.create }));
    const dialog = within(screen.getByRole('dialog', { name: en.metrics.create }));
    await user.type(dialog.getByLabelText(en.metrics.nameLabel), 'Open bugs');
    await user.click(dialog.getByRole('button', { name: en.metrics.cancel }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it('edits a metric without sending its direction, which it shows as fixed', async () => {
    const user = userEvent.setup();
    await renderSettings();

    await user.click(screen.getByRole('button', { name: 'Edit: Revenue' }));
    const form = screen.getByRole('listitem');
    const direction = within(form).getByLabelText(en.metrics.directionLabel);
    expect(direction).toBeDisabled();
    expect(direction).toHaveAccessibleDescription(en.metrics.directionFixed);
    const name = within(form).getByLabelText(en.metrics.nameLabel);
    await user.clear(name);
    await user.type(name, 'Sales');
    await user.click(within(form).getByRole('button', { name: en.metrics.save }));

    const [url, init] = writes()[0] ?? [];
    expect([url, init?.method]).toEqual([`/api/teams/${TEAM_ID}/metrics/metric-revenue`, 'PATCH']);
    expect(lastBody()).toMatchObject({ name: 'Sales', group_label: 'Finance' });
    expect(lastBody()).not.toHaveProperty('direction');
  });

  it('shows the refusal if a direction change reaches the API anyway', async () => {
    serve(() => errorResponse(409, 'direction', 'metric_direction.immutable'));
    const user = userEvent.setup();
    await renderSettings();

    await user.click(screen.getByRole('button', { name: 'Edit: Revenue' }));
    await user.click(screen.getByRole('button', { name: en.metrics.save }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      en.errors['metric_direction.immutable'],
    );
  });

  it('retires a metric and brings a retired one back', async () => {
    metrics = [metric(), metric({ id: 'metric-old', name: 'Old', retired: true })];
    const user = userEvent.setup();
    await renderSettings();

    await user.click(screen.getByRole('button', { name: 'Retire: Revenue' }));
    expect(lastBody()).toEqual({ retired: true });
    await user.click(screen.getByRole('button', { name: 'Bring back: Old' }));
    expect(lastBody()).toEqual({ retired: false });
    expect(screen.getAllByRole('listitem')[1]).toHaveTextContent(en.metrics.retired);
  });

  it('deletes a metric, and says why one with values cannot be', async () => {
    serve(() => errorResponse(409, null, 'metric.has_values'));
    const user = userEvent.setup();
    await renderSettings();

    await user.click(screen.getByRole('button', { name: 'Delete: Revenue' }));

    const [url, init] = writes()[0] ?? [];
    expect([url, init?.method]).toEqual([`/api/teams/${TEAM_ID}/metrics/metric-revenue`, 'DELETE']);
    expect(await screen.findByRole('alert')).toHaveTextContent(en.errors['metric.has_values']);
  });

  it('records a threshold version from numbers typed in Polish', async () => {
    const user = userEvent.setup();
    await renderSettings('pl');

    await user.click(screen.getByRole('button', { name: 'Zmień próg: Revenue' }));
    const dialog = screen.getByRole('dialog', { name: 'Nowy próg wskaźnika Revenue' });
    const from = within(dialog).getByLabelText(pl.metrics.effectiveFromLabel);
    expect(from).toHaveFocus();
    await user.clear(from);
    await user.type(from, '2026-09-01');
    await user.type(within(dialog).getByLabelText(pl.metrics.greenFrom), '95,5');
    await user.type(within(dialog).getByLabelText(pl.metrics.amberFrom), '1 085');
    await user.type(within(dialog).getByLabelText(pl.metrics.reasonLabel), 'Plan na Q4');
    await user.click(within(dialog).getByRole('button', { name: pl.metrics.recordThreshold }));

    expect(writes()[0]?.[0]).toBe(`/api/teams/${TEAM_ID}/metrics/metric-revenue/thresholds`);
    expect(lastBody()).toEqual({
      effective_from: '2026-09-01',
      reason: 'Plan na Q4',
      green: '95.5',
      amber: '1085',
    });
  });

  it('asks a band for both ends of each zone', async () => {
    metrics = [metric({ direction: 'within_band', threshold: null })];
    const user = userEvent.setup();
    await renderSettings();

    await user.click(screen.getByRole('button', { name: 'Change threshold: Revenue' }));
    const dialog = screen.getByRole('dialog');

    for (const label of [
      en.metrics.greenFrom,
      en.metrics.greenTo,
      en.metrics.amberFrom,
      en.metrics.amberTo,
    ]) {
      expect(within(dialog).getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('refuses a boundary that is not a number before sending anything', async () => {
    const user = userEvent.setup();
    await renderSettings();

    await user.click(screen.getByRole('button', { name: 'Change threshold: Revenue' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(en.metrics.greenFrom), '95,5');
    await user.type(within(dialog).getByLabelText(en.metrics.amberFrom), '85');
    await user.click(within(dialog).getByRole('button', { name: en.metrics.recordThreshold }));

    expect(writes()).toEqual([]);
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a number, such as 95.3.');
  });

  it('shows the threshold order error the API reports', async () => {
    serve(() => errorResponse(422, null, 'threshold.order_invalid'));
    const user = userEvent.setup();
    await renderSettings();

    await user.click(screen.getByRole('button', { name: 'Change threshold: Revenue' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(en.metrics.greenFrom), '85');
    await user.type(within(dialog).getByLabelText(en.metrics.amberFrom), '95');
    await user.type(within(dialog).getByLabelText(en.metrics.reasonLabel), 'Plan');
    await user.click(within(dialog).getByRole('button', { name: en.metrics.recordThreshold }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      en.errors['threshold.order_invalid'],
    );
  });

  it('shows the threshold history to anyone, with its reason and author', async () => {
    const user = userEvent.setup();
    await renderSettings('en', { email: MEMBER });

    await user.click(screen.getByRole('button', { name: 'Threshold history: Revenue' }));

    const history = await screen.findByRole('heading', { name: 'Threshold history: Revenue' });
    const entry = await within(history.parentElement as HTMLElement).findByText(/Plan for Q4/);
    expect(entry).toHaveTextContent(LEADER);
  });

  it('shows a member the metrics and thresholds without controls to change them', async () => {
    await renderSettings('en', { email: MEMBER });

    expect(screen.getByRole('listitem')).toHaveTextContent('Green from 95.0');
    for (const name of [
      en.metrics.create,
      /^Edit:/,
      /^Retire:/,
      /^Delete:/,
      /^Change threshold:/,
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('offers every control to an administrator outside the team', async () => {
    await renderSettings('en', { email: 'admin@example.com', isAdmin: true });

    expect(screen.getByRole('button', { name: en.metrics.create })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change threshold: Revenue' })).toBeInTheDocument();
  });
});

/*
 * Bringing a metric in from elsewhere, and how an included global metric
 * reads. Scenarios from specs/metrics ("Copy a metric from another board"),
 * specs/global-metrics and specs/authorization.
 */

const OTHER_TEAM = 'team-2';

const TEAMS: Team[] = [
  {
    id: TEAM_ID,
    name: 'Platform',
    board: TEAM.board,
    leader: { id: 'emp-anna', email: LEADER },
    member_count: 2,
  },
  {
    id: OTHER_TEAM,
    name: 'Sales',
    board: { id: 'board-2', name: 'Sales', schedule: null },
    leader: { id: 'emp-celina', email: 'celina@example.com' },
    member_count: 1,
  },
];

const OTHER_METRICS: Metric[] = [
  metric({ id: 'metric-open-bugs', team_id: OTHER_TEAM, name: 'Open bugs' }),
  metric({ id: 'metric-old-sales', team_id: OTHER_TEAM, name: 'Old sales', retired: true }),
  metric({ id: 'gm-availability', team_id: OTHER_TEAM, name: 'Availability', scope: 'global' }),
];

function globalMetric(overrides: Partial<GlobalMetric> = {}): GlobalMetric {
  return {
    id: 'gm-availability',
    scope: 'global',
    name: 'Availability',
    unit: '%',
    decimals: 2,
    direction: 'higher_is_better',
    retired: false,
    threshold: null,
    boards: 1,
    ...overrides,
  };
}

const CATALOGUE: GlobalMetric[] = [
  globalMetric(),
  globalMetric({ id: 'gm-security', name: 'Security findings', retired: true }),
  globalMetric({ id: 'gm-uptime', name: 'Uptime' }),
];

/** This board's metrics: its own Revenue, and the global Uptime it includes. */
const UPTIME = metric({
  id: 'gm-uptime',
  name: 'Uptime',
  unit: '%',
  decimals: 2,
  scope: 'global',
  group_label: 'Operations',
  position: 2,
});

/** As `serve`, and also the team list, another team's metrics and the catalogue. */
function serveElsewhere(write?: (url: string, init: RequestInit) => Response | undefined) {
  serve(write);
  const base = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((url: string, init: RequestInit = {}) => {
    if ((init.method ?? 'GET') === 'GET') {
      if (url.endsWith('/global-metrics')) return Promise.resolve(jsonResponse(CATALOGUE));
      if (url.endsWith('/api/teams')) return Promise.resolve(jsonResponse(TEAMS));
      if (url.endsWith(`/teams/${OTHER_TEAM}/metrics`)) {
        return Promise.resolve(jsonResponse(OTHER_METRICS));
      }
    }
    return base(url, init) as Promise<Response>;
  });
}

function optionNames(select: HTMLElement): string[] {
  return within(select)
    .getAllByRole('option')
    .map((option) => option.textContent ?? '');
}

async function openCopy(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: en.metrics.copy }));
  const dialog = screen.getByRole('dialog', { name: en.metrics.copy });
  await user.selectOptions(within(dialog).getByLabelText(en.metrics.copyTeamLabel), OTHER_TEAM);
  const source = within(dialog).getByLabelText(en.metrics.copySourceLabel);
  await within(source).findByRole('option', { name: 'Open bugs' });
  return { dialog, source };
}

async function openInclude(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: en.metrics.include }));
  const dialog = screen.getByRole('dialog', { name: en.metrics.include });
  const source = await within(dialog).findByLabelText(en.metrics.includeSourceLabel);
  return { dialog, source };
}

describe('copying a metric from another board', () => {
  beforeEach(() => serveElsewhere());

  it('copies a metric with its thresholds, sending only its source', async () => {
    // Scenario: A metric is copied with its thresholds - the server copies
    // the definition and every version; the page names only the source.
    const user = userEvent.setup();
    await renderSettings();

    const { dialog, source } = await openCopy(user);
    expect(optionNames(within(dialog).getByLabelText(en.metrics.copyTeamLabel))).toEqual([
      en.metrics.chooseTeam,
      'Sales',
    ]);
    await user.selectOptions(source, 'metric-open-bugs');
    await user.click(within(dialog).getByRole('button', { name: en.metrics.copySubmit }));

    expect(writes()[0]?.[0]).toBe(`/api/teams/${TEAM_ID}/metrics/copies`);
    expect(lastBody()).toEqual({ source_metric_id: 'metric-open-bugs' });
  });

  it('copies a metric under a new name', async () => {
    // Scenario: A copy under a new name.
    const user = userEvent.setup();
    await renderSettings();

    const { dialog, source } = await openCopy(user);
    await user.selectOptions(source, 'metric-open-bugs');
    await user.type(within(dialog).getByLabelText(en.metrics.copyNameLabel), 'Revenue (Poland)');
    await user.click(within(dialog).getByRole('button', { name: en.metrics.copySubmit }));

    expect(lastBody()).toEqual({
      source_metric_id: 'metric-open-bugs',
      name: 'Revenue (Poland)',
    });
  });

  it('offers only the other board’s own metrics, retired ones marked', async () => {
    const user = userEvent.setup();
    await renderSettings();

    const { source } = await openCopy(user);

    expect(optionNames(source)).toEqual([
      en.metrics.chooseMetric,
      'Open bugs',
      'Old sales (retired)',
    ]);
  });

  it('shows a taken copied name against the name field', async () => {
    // Scenario: The copied name is taken.
    serveElsewhere(() => errorResponse(409, 'name', 'metric_name.duplicate'));
    const user = userEvent.setup();
    await renderSettings();

    const { dialog, source } = await openCopy(user);
    await user.selectOptions(source, 'metric-open-bugs');
    await user.click(within(dialog).getByRole('button', { name: en.metrics.copySubmit }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      en.errors['metric_name.duplicate'],
    );
    expect(within(dialog).getByLabelText(en.metrics.copyNameLabel)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('says a global metric is not copied, should one reach the API', async () => {
    // Scenario: A global metric is not copied.
    serveElsewhere(() => errorResponse(409, 'source_metric_id', 'metric_copy.source_global'));
    const user = userEvent.setup();
    await renderSettings();

    const { dialog, source } = await openCopy(user);
    expect(optionNames(source)).not.toContain('Availability');
    await user.selectOptions(source, 'metric-open-bugs');
    await user.click(within(dialog).getByRole('button', { name: en.metrics.copySubmit }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      en.errors['metric_copy.source_global'],
    );
  });
});

describe('including a global metric', () => {
  beforeEach(() => {
    metrics = [metric(), UPTIME];
    serveElsewhere();
  });

  it('includes an active global metric with its placement on the board', async () => {
    // Scenario: A global metric is included.
    const user = userEvent.setup();
    await renderSettings();

    const { dialog, source } = await openInclude(user);
    // Security findings is retired and Uptime is on the board already.
    expect(optionNames(source)).toEqual([en.metrics.chooseGlobal, 'Availability']);
    await user.selectOptions(source, 'gm-availability');
    await user.type(within(dialog).getByLabelText(en.metrics.groupLabel), 'Operations');
    const position = within(dialog).getByLabelText(en.metrics.positionLabel);
    await user.clear(position);
    await user.type(position, '2');
    await user.selectOptions(within(dialog).getByLabelText(en.metrics.ownerLabel), 'emp-bartek');
    await user.click(within(dialog).getByRole('button', { name: en.metrics.includeSubmit }));

    expect(writes()[0]?.[0]).toBe(`/api/teams/${TEAM_ID}/metrics/inclusions`);
    expect(lastBody()).toEqual({
      global_metric_id: 'gm-availability',
      position: 2,
      group_label: 'Operations',
      owner_employee_id: 'emp-bartek',
    });
  });

  it('says a global metric is already included, should that reach the API', async () => {
    // Scenario: Included twice.
    serveElsewhere(() => errorResponse(409, 'global_metric_id', 'global_metric.already_included'));
    const user = userEvent.setup();
    await renderSettings();

    const { dialog, source } = await openInclude(user);
    await user.selectOptions(source, 'gm-availability');
    await user.click(within(dialog).getByRole('button', { name: en.metrics.includeSubmit }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      en.errors['global_metric.already_included'],
    );
  });

  it('shows a name clash with the board’s own metric against the chosen metric', async () => {
    // Scenario: Its name is taken on the board.
    serveElsewhere(() => errorResponse(409, 'global_metric_id', 'metric_name.duplicate'));
    const user = userEvent.setup();
    await renderSettings();

    const { dialog, source } = await openInclude(user);
    await user.selectOptions(source, 'gm-availability');
    await user.click(within(dialog).getByRole('button', { name: en.metrics.includeSubmit }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      en.errors['metric_name.duplicate'],
    );
    expect(source).toHaveAttribute('aria-invalid', 'true');
  });

  it('says so when every active global metric is on the board already', async () => {
    metrics = [metric(), UPTIME, metric({ id: 'gm-availability', scope: 'global' })];
    const user = userEvent.setup();
    await renderSettings();

    await user.click(screen.getByRole('button', { name: en.metrics.include }));

    expect(await screen.findByText(en.metrics.includeNone)).toBeInTheDocument();
  });
});

describe('an included global metric on the settings page', () => {
  beforeEach(() => {
    metrics = [metric(), UPTIME];
    serveElsewhere();
  });

  function uptimeRow() {
    return screen.getAllByRole('listitem')[1]!;
  }

  it('shows a global metric read-only, offering its placement only', async () => {
    // Scenario: The settings page shows a global metric read-only.
    const user = userEvent.setup();
    await renderSettings();

    const row = uptimeRow();
    expect(within(row).getByText(en.metrics.global)).toBeInTheDocument();
    expect(row).toHaveTextContent(en.metrics.globalNote);
    expect(within(row).getByRole('link', { name: en.nav.globalMetrics })).toHaveAttribute(
      'href',
      '/global-metrics',
    );
    expect(row).toHaveTextContent(`${en.direction.higher_is_better} · % · Decimals: 2`);
    expect(
      within(row).queryByRole('button', { name: 'Change threshold: Uptime' }),
    ).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Edit: Uptime' })).not.toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: 'Edit placement: Uptime' }));
    for (const label of [
      en.metrics.nameLabel,
      en.metrics.unitLabel,
      en.metrics.decimalsLabel,
      en.metrics.directionLabel,
    ]) {
      expect(within(row).queryByLabelText(label)).not.toBeInTheDocument();
    }
    const group = within(row).getByLabelText(en.metrics.groupLabel);
    await user.clear(group);
    await user.type(group, 'Reliability');
    await user.click(within(row).getByRole('button', { name: en.metrics.save }));

    const [url, init] = writes()[0] ?? [];
    expect([url, init?.method]).toEqual([`/api/teams/${TEAM_ID}/metrics/gm-uptime`, 'PATCH']);
    expect(lastBody()).toEqual({
      group_label: 'Reliability',
      position: 2,
      owner_employee_id: null,
    });
  });

  it('offers no bring-back for a global metric retired in the catalogue', async () => {
    metrics = [
      metric(),
      { ...UPTIME, retired: true, retired_in_catalogue: true },
      metric({ id: 'gm-on-board', name: 'Latency', scope: 'global', retired: true }),
    ];
    await renderSettings();

    const [, retiredInCatalogue, retiredHere] = screen.getAllByRole('listitem');
    expect(retiredInCatalogue).toHaveTextContent(en.metrics.retiredInCatalogue);
    expect(
      within(retiredInCatalogue!).queryByRole('button', { name: 'Bring back: Uptime' }),
    ).not.toBeInTheDocument();
    expect(
      within(retiredHere!).getByRole('button', { name: 'Bring back: Latency' }),
    ).toBeInTheDocument();
  });

  it('shows a global metric’s threshold history from the board, without a way to add one', async () => {
    const user = userEvent.setup();
    await renderSettings();

    await user.click(
      within(uptimeRow()).getByRole('button', { name: 'Threshold history: Uptime' }),
    );

    expect(await within(uptimeRow()).findByText(/Plan for Q4/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/teams/${TEAM_ID}/metrics/gm-uptime/thresholds`,
      expect.anything(),
    );
    expect(
      within(uptimeRow()).queryByRole('button', { name: 'Change threshold: Uptime' }),
    ).toBeNull();
  });

  it('retires a global metric on this board, and removes it from the board', async () => {
    // Scenario: A global metric is retired on one board; removal refused with values.
    serveElsewhere((_url, init) =>
      init.method === 'DELETE' ? errorResponse(409, null, 'metric.has_values') : undefined,
    );
    const user = userEvent.setup();
    await renderSettings();

    await user.click(within(uptimeRow()).getByRole('button', { name: 'Retire: Uptime' }));
    expect(lastBody()).toEqual({ retired: true });

    await user.click(
      within(uptimeRow()).getByRole('button', { name: 'Remove from board: Uptime' }),
    );
    const [url, init] = writes().at(-1) ?? [];
    expect([url, init?.method]).toEqual([`/api/teams/${TEAM_ID}/metrics/gm-uptime`, 'DELETE']);
    expect(await within(uptimeRow()).findByRole('alert')).toHaveTextContent(
      en.errors['metric.has_values'],
    );
  });

  it('says why a definition change was refused, should one reach the API', async () => {
    serveElsewhere(() => errorResponse(409, null, 'global_metric.read_only'));
    const user = userEvent.setup();
    await renderSettings();

    await user.click(within(uptimeRow()).getByRole('button', { name: 'Edit placement: Uptime' }));
    await user.click(within(uptimeRow()).getByRole('button', { name: en.metrics.save }));

    expect(await within(uptimeRow()).findByRole('alert')).toHaveTextContent(
      en.errors['global_metric.read_only'],
    );
  });

  it('shows a member no control to copy, include or place a metric', async () => {
    // Scenario: A member records values but does not configure metrics - the settings half.
    await renderSettings('en', { email: MEMBER });

    expect(within(uptimeRow()).getByText(en.metrics.global)).toBeInTheDocument();
    for (const name of [
      en.metrics.copy,
      en.metrics.include,
      /^Edit placement:/,
      /^Remove from board:/,
      /^Retire:/,
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('reads in Polish', async () => {
    await renderSettings('pl');

    expect(screen.getByRole('button', { name: pl.metrics.copy })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: pl.metrics.include })).toBeInTheDocument();
    expect(within(uptimeRow()).getByText(pl.metrics.global)).toBeInTheDocument();
    expect(uptimeRow()).toHaveTextContent(pl.metrics.globalNote);
  });
});
