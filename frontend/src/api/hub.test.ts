/** The hub client: picking a language out of the payload, and fetching it. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchHubSummary, localized } from './hub';
import { ApiError } from './client';

afterEach(() => {
  vi.restoreAllMocks();
});

const TEXT = { en: 'Small steps', pl: 'Małe kroki' };

describe('localized', () => {
  it('reads the English text when English is active', () => {
    expect(localized(TEXT, 'en')).toBe('Small steps');
  });

  it('reads the Polish text when Polish is active', () => {
    expect(localized(TEXT, 'pl')).toBe('Małe kroki');
  });
});

describe('fetchHubSummary', () => {
  it('requests the hub endpoint and returns the body', async () => {
    const body = { provisional: true, teams: [] };
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));

    await expect(fetchHubSummary()).resolves.toMatchObject(body);
    expect(fetchSpy).toHaveBeenCalledWith('/api/hub', expect.anything());
  });

  it('raises an ApiError when the request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));

    await expect(fetchHubSummary()).rejects.toBeInstanceOf(ApiError);
  });
});
