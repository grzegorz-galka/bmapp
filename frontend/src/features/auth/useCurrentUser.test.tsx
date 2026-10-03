/**
 * Requirement: the current user can be read.
 *
 * Whether someone is an administrator is server-side configuration, so it
 * must come from its own request and cannot be worked out from anything the
 * browser already holds.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuthContext, type AuthState } from './AuthProvider';
import { useCurrentUser, useIsAdmin } from './useCurrentUser';

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function wrapper(status: AuthState['status'] = 'signedIn') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const session: AuthState = {
    status,
    email: 'jan.kowalski@pse.pl',
    signIn: async () => {},
    signOut: async () => {},
  };
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={session}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
}

it('asks the API who the caller is', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ email: 'admin@pse.pl', is_admin: true }),
  } as Response);

  const { result } = renderHook(() => useCurrentUser(), { wrapper: wrapper() });

  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(result.current.data).toEqual({ email: 'admin@pse.pl', is_admin: true });
  expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/auth/me');
});

it('reports an administrator as one', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ email: 'admin@pse.pl', is_admin: true }),
  } as Response);

  const { result } = renderHook(() => useIsAdmin(), { wrapper: wrapper() });

  await waitFor(() => expect(result.current).toBe(true));
});

it('assumes nobody is an administrator until the answer arrives', () => {
  fetchMock.mockImplementation(() => new Promise(() => {}));

  const { result } = renderHook(() => useIsAdmin(), { wrapper: wrapper() });

  expect(result.current).toBe(false);
});

it('asks nothing while nobody is signed in', () => {
  const { result } = renderHook(() => useIsAdmin(), { wrapper: wrapper('signedOut') });

  expect(fetchMock).not.toHaveBeenCalled();
  expect(result.current).toBe(false);
});
