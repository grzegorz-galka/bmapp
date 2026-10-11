/**
 * The client for global metrics: the catalogue's own resource, and the two
 * board endpoints that bring a metric in from elsewhere - including a global
 * metric and copying another board's metric. Paths and bodies as design.md's
 * "Endpoints" table fixes them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addGlobalMetric,
  addGlobalThreshold,
  changeGlobalMetric,
  deleteGlobalMetric,
  getGlobalMetrics,
  getGlobalThresholds,
} from './globalMetrics';
import { copyMetric, includeGlobalMetric } from './metrics';
import { ApiError } from './client';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  // A fresh response per call: a body can be read only once.
  fetchMock.mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify({}), { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The one request made, as [path, method, parsed body]. */
function sent(): [string, string, unknown] {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return [url, init.method ?? 'GET', init.body ? JSON.parse(String(init.body)) : undefined];
}

describe('the global metrics client', () => {
  it('reads the catalogue', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    await expect(getGlobalMetrics()).resolves.toEqual([]);
    expect(sent()).toEqual(['/api/global-metrics', 'GET', undefined]);
  });

  it('adds a global metric with its definition only', async () => {
    await addGlobalMetric({
      name: 'Service availability',
      unit: '%',
      decimals: 2,
      direction: 'higher_is_better',
    });

    expect(sent()).toEqual([
      '/api/global-metrics',
      'POST',
      { name: 'Service availability', unit: '%', decimals: 2, direction: 'higher_is_better' },
    ]);
  });

  it('changes and retires a global metric by its identifier', async () => {
    await changeGlobalMetric('gm 1', { name: 'Uptime', retired: true });

    expect(sent()).toEqual([
      '/api/global-metrics/gm%201',
      'PATCH',
      { name: 'Uptime', retired: true },
    ]);
  });

  it('deletes a global metric', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteGlobalMetric('gm-1')).resolves.toBeUndefined();
    expect(sent()).toEqual(['/api/global-metrics/gm-1', 'DELETE', undefined]);
  });

  it('reads and records threshold versions in the catalogue', async () => {
    await getGlobalThresholds('gm-1');
    expect(sent()).toEqual(['/api/global-metrics/gm-1/thresholds', 'GET', undefined]);

    const version = { effective_from: '2026-10-01', reason: 'SLA', green: '99.5', amber: '99' };
    await addGlobalThreshold('gm-1', version);
    expect(sent()).toEqual(['/api/global-metrics/gm-1/thresholds', 'POST', version]);
  });

  it('raises the refusal as an ApiError carrying its code', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ errors: [{ field: null, code: 'auth.forbidden', message: 'no' }] }),
        { status: 403 },
      ),
    );

    const failure = await addGlobalMetric({
      name: 'X',
      unit: '',
      decimals: 0,
      direction: 'lower_is_better',
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).errors[0]?.code).toBe('auth.forbidden');
  });
});

describe('bringing a metric onto a board', () => {
  it('includes a global metric with its placement on the board', async () => {
    const inclusion = {
      global_metric_id: 'gm-1',
      position: 2,
      group_label: 'Operations',
      owner_employee_id: 'emp-anna',
    };
    await includeGlobalMetric('team-1', inclusion);

    expect(sent()).toEqual(['/api/teams/team-1/metrics/inclusions', 'POST', inclusion]);
  });

  it('copies another board’s metric, under a new name when one is given', async () => {
    await copyMetric('team-1', { source_metric_id: 'metric-9', name: 'Revenue (Poland)' });
    expect(sent()).toEqual([
      '/api/teams/team-1/metrics/copies',
      'POST',
      { source_metric_id: 'metric-9', name: 'Revenue (Poland)' },
    ]);

    await copyMetric('team-1', { source_metric_id: 'metric-9' });
    expect(sent()[2]).toEqual({ source_metric_id: 'metric-9' });
  });
});
