/**
 * The metric settings page: adding, editing, retiring and deleting metrics,
 * recording a threshold version, and what a member who may not configure the
 * board sees.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { MetricSettingsPage } from './MetricSettingsPage';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import type { Language } from '../../i18n/languages';
import type { Metric, Threshold } from '../../api/metrics';
import type { TeamDetail } from '../../api/teams';

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
    name: 'Revenue',
    unit: 'mln zł',
    decimals: 1,
    direction: 'higher_is_better',
    group_label: 'Finance',
    position: 1,
    owner: null,
    retired: false,
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
    expect(screen.getByRole('button', { name: pl.metrics.add })).toBeInTheDocument();
  });

  it('adds a metric with every property', async () => {
    const user = userEvent.setup();
    await renderSettings();

    await user.type(screen.getByLabelText(en.metrics.nameLabel), 'Open bugs');
    await user.type(screen.getByLabelText(en.metrics.unitLabel), 'pcs');
    await user.selectOptions(screen.getByLabelText(en.metrics.directionLabel), 'lower_is_better');
    await user.type(screen.getByLabelText(en.metrics.groupLabel), 'Quality');
    await user.selectOptions(screen.getByLabelText(en.metrics.ownerLabel), 'emp-bartek');
    await user.click(screen.getByRole('button', { name: en.metrics.add }));

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

  it('shows a rejected name against the name field', async () => {
    serve(() => errorResponse(409, 'name', 'metric_name.duplicate'));
    const user = userEvent.setup();
    await renderSettings();

    await user.type(screen.getByLabelText(en.metrics.nameLabel), 'revenue');
    await user.click(screen.getByRole('button', { name: en.metrics.add }));

    expect(await screen.findByRole('alert')).toHaveTextContent(en.errors['metric_name.duplicate']);
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
    for (const name of [en.metrics.add, /^Edit:/, /^Retire:/, /^Delete:/, /^Change threshold:/]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('offers every control to an administrator outside the team', async () => {
    await renderSettings('en', { email: 'admin@example.com', isAdmin: true });

    expect(screen.getByRole('button', { name: en.metrics.add })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change threshold: Revenue' })).toBeInTheDocument();
  });
});
