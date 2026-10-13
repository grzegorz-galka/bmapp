/**
 * The global metrics page: the catalogue for everyone, and adding, changing,
 * retiring, deleting and recording thresholds for an administrator. Scenarios
 * from specs/global-metrics ("The global metrics page") and specs/authorization
 * ("A leader sees the global metrics without controls").
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlobalMetricsPage } from './GlobalMetricsPage';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import type { Language } from '../../i18n/languages';
import type { GlobalMetric } from '../../api/globalMetrics';
import type { Threshold } from '../../api/metrics';

const ADMIN = 'admin@example.com';
const LEADER = 'anna@example.com';

const THRESHOLD: Threshold = {
  id: 'th-1',
  metric_id: 'gm-availability',
  effective_from: '2026-10-01',
  green_lo: '99.5',
  green_hi: null,
  amber_lo: '99',
  amber_hi: null,
  reason: 'Company SLA',
  recorded_by_email: ADMIN,
  recorded_at: '2026-10-01T08:00:00Z',
};

function globalMetric(overrides: Partial<GlobalMetric> = {}): GlobalMetric {
  return {
    id: 'gm-availability',
    scope: 'global',
    name: 'Availability',
    unit: '%',
    decimals: 2,
    direction: 'higher_is_better',
    retired: false,
    threshold: THRESHOLD,
    boards: 2,
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
let catalogue: GlobalMetric[];

function serve(write: (url: string, init: RequestInit) => Response | undefined = () => undefined) {
  fetchMock.mockImplementation((url: string, init: RequestInit = {}) => {
    if ((init.method ?? 'GET') !== 'GET') {
      return Promise.resolve(write(url, init) ?? jsonResponse(catalogue[0], 200));
    }
    if (url.endsWith('/thresholds')) return Promise.resolve(jsonResponse([THRESHOLD]));
    return Promise.resolve(jsonResponse(catalogue));
  });
}

function writes(): [string, RequestInit][] {
  const calls = fetchMock.mock.calls as [string, RequestInit | undefined][];
  return calls.filter(
    (call): call is [string, RequestInit] =>
      call[1]?.method !== undefined && call[1].method !== 'GET',
  );
}

function lastWrite(): [string, string, unknown] {
  const [url, init] = writes().at(-1) ?? ['', {}];
  return [url, init.method ?? '', init.body ? JSON.parse(String(init.body)) : undefined];
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  catalogue = [
    globalMetric(),
    globalMetric({
      id: 'gm-security',
      name: 'Security findings',
      unit: '',
      decimals: 0,
      direction: 'lower_is_better',
      retired: true,
      threshold: null,
      boards: 0,
    }),
  ];
  serve();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderPage(
  language: Language = 'en',
  auth: { email?: string; isAdmin?: boolean } = { email: ADMIN, isAdmin: true },
) {
  await renderWithLanguage(<GlobalMetricsPage />, language, { route: '/global-metrics', auth });
  const catalogueText = language === 'en' ? en : pl;
  return screen.findByRole('list', { name: catalogueText.globalMetrics.listLabel });
}

const controls = [
  en.globalMetrics.add,
  /^Edit:/,
  /^Change threshold:/,
  /^Retire:/,
  /^Bring back:/,
  /^Delete:/,
];

describe('the global metrics page', () => {
  it('The catalogue is shown', async () => {
    const list = await renderPage('en', { email: LEADER });

    const [availability, security] = within(list).getAllByRole('listitem');
    expect(availability).toHaveTextContent('Availability');
    expect(availability).toHaveTextContent(
      `${en.direction.higher_is_better} · % · Decimals: 2 · Boards including it: 2`,
    );
    expect(availability).toHaveTextContent('Green from 99.50 %, amber from 99.00 %');
    expect(availability).not.toHaveTextContent(en.metrics.retired);
    expect(security).toHaveTextContent(en.metrics.retired);
    expect(security).toHaveTextContent('Boards including it: 0');
    expect(security).toHaveTextContent(en.threshold.none);
  });

  it('The add form is hidden until asked for', async () => {
    await renderPage();

    expect(screen.getByRole('button', { name: en.globalMetrics.add })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(en.metrics.nameLabel)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(en.metrics.unitLabel)).not.toBeInTheDocument();
  });

  it('A global metric is added from the dialog', async () => {
    serve((url) => {
      if (url !== '/api/global-metrics') return undefined;
      const added = globalMetric({ id: 'gm-uptime', name: 'Service availability', boards: 0 });
      catalogue = [...catalogue, added];
      return jsonResponse(added, 201);
    });
    const user = userEvent.setup();
    const list = await renderPage();

    await user.click(screen.getByRole('button', { name: en.globalMetrics.add }));
    const dialog = within(screen.getByRole('dialog', { name: en.globalMetrics.add }));
    // A definition only: the placement belongs to each including board.
    expect(dialog.queryByLabelText(en.metrics.groupLabel)).not.toBeInTheDocument();
    expect(dialog.queryByLabelText(en.metrics.ownerLabel)).not.toBeInTheDocument();
    await user.type(dialog.getByLabelText(en.metrics.nameLabel), 'Service availability');
    await user.type(dialog.getByLabelText(en.metrics.unitLabel), '%');
    const decimals = dialog.getByLabelText(en.metrics.decimalsLabel);
    await user.clear(decimals);
    await user.type(decimals, '2');
    await user.click(dialog.getByRole('button', { name: en.metrics.add }));

    expect(lastWrite()).toEqual([
      '/api/global-metrics',
      'POST',
      { name: 'Service availability', unit: '%', decimals: 2, direction: 'higher_is_better' },
    ]);
    expect(await within(list).findByText('Service availability')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('A rejection keeps the dialog open', async () => {
    serve(() => errorResponse(409, 'name', 'metric_name.duplicate'));
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: en.globalMetrics.add }));
    const dialog = within(screen.getByRole('dialog', { name: en.globalMetrics.add }));
    await user.type(dialog.getByLabelText(en.metrics.nameLabel), 'availability');
    await user.type(dialog.getByLabelText(en.metrics.unitLabel), '%');
    await user.click(dialog.getByRole('button', { name: en.metrics.add }));

    expect(await dialog.findByRole('alert')).toHaveTextContent(en.errors['metric_name.duplicate']);
    const name = dialog.getByLabelText(en.metrics.nameLabel);
    expect(name).toHaveValue('availability');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(dialog.getByLabelText(en.metrics.unitLabel)).toHaveValue('%');
  });

  it('changes a global metric without sending its direction, which it shows as fixed', async () => {
    const user = userEvent.setup();
    const list = await renderPage();

    await user.click(within(list).getByRole('button', { name: 'Edit: Availability' }));
    const row = within(list).getAllByRole('listitem')[0]!;
    expect(within(row).getByLabelText(en.metrics.directionLabel)).toBeDisabled();
    expect(within(row).queryByLabelText(en.metrics.groupLabel)).not.toBeInTheDocument();
    const name = within(row).getByLabelText(en.metrics.nameLabel);
    await user.clear(name);
    await user.type(name, 'Uptime');
    await user.click(within(row).getByRole('button', { name: en.metrics.save }));

    expect(lastWrite()).toEqual([
      '/api/global-metrics/gm-availability',
      'PATCH',
      { name: 'Uptime', unit: '%', decimals: 2 },
    ]);
  });

  it('shows a rename that clashes on an including board', async () => {
    // Scenario: A rename that clashes on an including board.
    serve(() => errorResponse(409, 'name', 'metric_name.duplicate'));
    const user = userEvent.setup();
    const list = await renderPage();

    await user.click(within(list).getByRole('button', { name: 'Edit: Availability' }));
    await user.click(within(list).getByRole('button', { name: en.metrics.save }));

    expect(await within(list).findByRole('alert')).toHaveTextContent(
      en.errors['metric_name.duplicate'],
    );
  });

  it('retires a global metric and brings a retired one back', async () => {
    const user = userEvent.setup();
    const list = await renderPage();

    await user.click(within(list).getByRole('button', { name: 'Retire: Availability' }));
    expect(lastWrite()).toEqual([
      '/api/global-metrics/gm-availability',
      'PATCH',
      { retired: true },
    ]);
    await user.click(within(list).getByRole('button', { name: 'Bring back: Security findings' }));
    expect(lastWrite()).toEqual(['/api/global-metrics/gm-security', 'PATCH', { retired: false }]);
  });

  it('deletes a global metric, and says why one with values cannot be', async () => {
    serve(() => errorResponse(409, null, 'metric.has_values'));
    const user = userEvent.setup();
    const list = await renderPage();

    await user.click(within(list).getByRole('button', { name: 'Delete: Availability' }));

    expect(lastWrite()).toEqual(['/api/global-metrics/gm-availability', 'DELETE', undefined]);
    expect(await within(list).findByRole('alert')).toHaveTextContent(
      en.errors['metric.has_values'],
    );
  });

  it('records a threshold version in the catalogue', async () => {
    const user = userEvent.setup();
    const list = await renderPage();

    await user.click(within(list).getByRole('button', { name: 'Change threshold: Availability' }));
    const dialog = screen.getByRole('dialog', { name: 'New threshold for Availability' });
    const from = within(dialog).getByLabelText(en.metrics.effectiveFromLabel);
    await user.clear(from);
    await user.type(from, '2026-10-01');
    await user.type(within(dialog).getByLabelText(en.metrics.greenFrom), '99.5');
    await user.type(within(dialog).getByLabelText(en.metrics.amberFrom), '99');
    await user.type(within(dialog).getByLabelText(en.metrics.reasonLabel), 'Company SLA');
    await user.click(within(dialog).getByRole('button', { name: en.metrics.recordThreshold }));

    expect(lastWrite()).toEqual([
      '/api/global-metrics/gm-availability/thresholds',
      'POST',
      { effective_from: '2026-10-01', reason: 'Company SLA', green: '99.5', amber: '99' },
    ]);
  });

  it('shows an invalid threshold version as the API reports it', async () => {
    // Scenario: Invalid versions are refused as for a board's metric.
    serve(() => errorResponse(422, null, 'threshold.order_invalid'));
    const user = userEvent.setup();
    const list = await renderPage();

    await user.click(within(list).getByRole('button', { name: 'Change threshold: Availability' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(en.metrics.greenFrom), '99');
    await user.type(within(dialog).getByLabelText(en.metrics.amberFrom), '99.5');
    await user.type(within(dialog).getByLabelText(en.metrics.reasonLabel), 'SLA');
    await user.click(within(dialog).getByRole('button', { name: en.metrics.recordThreshold }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      en.errors['threshold.order_invalid'],
    );
  });

  it('shows the threshold history from the catalogue to anyone', async () => {
    const user = userEvent.setup();
    const list = await renderPage('en', { email: LEADER });

    await user.click(within(list).getByRole('button', { name: 'Threshold history: Availability' }));

    expect(await within(list).findByText(/Company SLA/)).toHaveTextContent(ADMIN);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/global-metrics/gm-availability/thresholds',
      expect.anything(),
    );
  });

  it('shows a leader the catalogue without controls, and an administrator all of them', async () => {
    // Scenario: A leader sees the global metrics without controls.
    const leaderList = await renderPage('en', { email: LEADER });

    expect(within(leaderList).getAllByRole('listitem')).toHaveLength(2);
    for (const name of controls) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByLabelText(en.metrics.nameLabel)).not.toBeInTheDocument();

    cleanup();
    await renderPage('en', { email: ADMIN, isAdmin: true });

    for (const name of controls) {
      expect(screen.getAllByRole('button', { name }).length).toBeGreaterThan(0);
    }
  });

  it('reads in Polish, numbers included', async () => {
    const list = await renderPage('pl');

    expect(screen.getByRole('heading', { name: pl.globalMetrics.heading })).toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent(
      'Zielony od 99,50 %, żółty od 99,00 %',
    );
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent(
      'Tablice, które go dołączają: 2',
    );
    expect(screen.getByRole('button', { name: pl.globalMetrics.add })).toBeInTheDocument();
  });

  it('says when the catalogue is empty', async () => {
    catalogue = [];
    await renderWithLanguage(<GlobalMetricsPage />, 'en', { route: '/global-metrics' });

    expect(await screen.findByText(en.globalMetrics.empty)).toBeInTheDocument();
  });

  it('says when the catalogue could not be loaded', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(errorResponse(500, null, 'x')));
    await renderWithLanguage(<GlobalMetricsPage />, 'en', { route: '/global-metrics' });

    expect(await screen.findByRole('alert')).toHaveTextContent(en.globalMetrics.loadFailed);
  });
});
