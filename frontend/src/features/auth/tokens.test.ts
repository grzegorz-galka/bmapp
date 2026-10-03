/**
 * Requirement: A person signs in through the identity broker.
 *
 * The half of it that is about where tokens are kept.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryStorage, buildSettings, CALLBACK_PATH } from './config';
import { request, resetAuthForTests, setAccessToken, setReauthenticate } from '../../api/client';

afterEach(() => {
  resetAuthForTests();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

type FetchMock = ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

function respondWith(status: number, body: unknown): FetchMock {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
}

describe('tokens do not outlive the page', () => {
  it('keeps nothing in sessionStorage or localStorage', () => {
    const store = new InMemoryStorage();
    store.setItem('user', 'a-token');

    expect(store.getItem('user')).toBe('a-token');
    expect(window.sessionStorage.length).toBe(0);
    expect(window.localStorage.length).toBe(0);
  });

  it('is what the user manager is configured to use', () => {
    const settings = buildSettings('https://bmapp.example');

    // Both stores: the tokens once signed in, and the PKCE verifier while
    // signing in, which is just as sensitive.
    expect(settings.userStore).toBeDefined();
    expect(settings.stateStore).toBeDefined();
    expect(JSON.stringify(settings)).not.toContain('sessionStorage');
  });

  it('forgets everything a reload would have to restore', () => {
    const store = new InMemoryStorage();
    store.setItem('a', '1');
    store.setItem('b', '2');
    expect(store.length).toBe(2);
    expect(store.key(0)).toBe('a');

    store.removeItem('a');
    expect(store.getItem('a')).toBeNull();
    store.clear();
    expect(store.length).toBe(0);
  });
});

describe('the broker configuration', () => {
  it('asks for a code flow with no client secret', () => {
    const settings = buildSettings('https://bmapp.example');

    expect(settings.response_type).toBe('code');
    expect(JSON.stringify(settings)).not.toContain('client_secret');
  });

  it('returns the browser to the callback route this application serves', () => {
    const settings = buildSettings('https://bmapp.example');

    expect(settings.redirect_uri).toBe(`https://bmapp.example${CALLBACK_PATH}`);
  });

  it('asks for a refresh token so the session can be renewed silently', () => {
    expect(buildSettings('https://bmapp.example').scope).toContain('offline_access');
  });
});

describe('the access token on every request', () => {
  it('is sent once there is one', async () => {
    const fetchMock = respondWith(200, { ok: true });
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken('a-token');

    await request('/teams');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer a-token' });
  });

  it('is absent when signed out', async () => {
    const fetchMock = respondWith(200, { ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await request('/teams');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.headers).not.toHaveProperty('Authorization');
  });
});

describe('a 401 is a lost session, not a field error', () => {
  it('renews once and retries, and the retry carries the fresh token', async () => {
    const calls: RequestInit[] = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(init);
      return calls.length === 1
        ? new Response(JSON.stringify({ errors: [{ code: 'auth.token_expired' }] }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        : new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
    });
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken('stale');
    setReauthenticate(async () => 'fresh');

    await expect(request('/teams')).resolves.toEqual({ ok: true });

    expect(calls).toHaveLength(2);
    expect(calls[1]?.headers).toMatchObject({ Authorization: 'Bearer fresh' });
  });

  it('retries exactly once and never loops', async () => {
    let attempts = 0;
    const fetchMock = vi.fn(async () => {
      attempts += 1;
      return new Response(JSON.stringify({ errors: [{ code: 'auth.token_expired' }] }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken('stale');
    setReauthenticate(async () => 'fresh-but-also-refused');

    await expect(request('/teams')).rejects.toMatchObject({ status: 401 });

    expect(attempts).toBe(2);
  });

  it('does not retry when renewal fails', async () => {
    let attempts = 0;
    const fetchMock = vi.fn(async () => {
      attempts += 1;
      return new Response(JSON.stringify({ errors: [{ code: 'auth.token_expired' }] }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    setReauthenticate(async () => null);

    await expect(request('/teams')).rejects.toMatchObject({ status: 401 });

    expect(attempts).toBe(1);
  });
});
