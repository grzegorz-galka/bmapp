/**
 * The session, obtained locally instead of from the identity broker.
 *
 * The counterpart of the backend's development mode, and selected the same
 * way: only when the application is explicitly told to. Without it nothing
 * could be signed in to where the broker is unreachable, which is every
 * developer's machine and the end-to-end suite.
 *
 * The token it obtains is signed with an algorithm a broker-backed server
 * never accepts, so nothing here can reach a deployed one.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AuthContext, type AuthState, type SessionStatus } from './AuthProvider';
import { setAccessToken, setReauthenticate } from '../../api/client';
import { DEV_EMAIL_KEY } from './devEmail';

export { DEV_EMAIL_KEY };

function chosenEmail(): string {
  try {
    const stored = window.localStorage.getItem(DEV_EMAIL_KEY);
    if (stored && stored.trim() !== '') return stored.trim().toLowerCase();
  } catch {
    // Private windows and blocked storage fall through to the default.
  }
  return (import.meta.env.VITE_DEV_EMAIL ?? 'admin@example.com').toLowerCase();
}

async function obtainToken(email: string): Promise<string | null> {
  const base = import.meta.env.VITE_API_BASE_URL ?? '/api';
  const response = await fetch(`${base}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { access_token?: string };
  return body.access_token ?? null;
}

export function DevAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('restoring');
  const [email, setEmail] = useState<string | null>(null);
  const queryClient = useQueryClient();
  // Set when the person signs out on purpose. Without it the handler below
  // would answer the first 401 after a sign-out by signing them back in.
  const signedOutOnPurpose = useRef(false);

  const signIn = useCallback(async () => {
    const address = chosenEmail();
    const token = await obtainToken(address);
    if (token) {
      setAccessToken(token);
      setEmail(address);
      setStatus('signedIn');
    } else {
      setAccessToken(null);
      setEmail(null);
      setStatus('signedOut');
    }
  }, []);

  const signOut = useCallback(async () => {
    signedOutOnPurpose.current = true;
    setAccessToken(null);
    setEmail(null);
    setStatus('signedOut');
    // As in the broker-backed provider: what was fetched belonged to whoever
    // has just signed out.
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    let cancelled = false;

    async function obtain() {
      const address = chosenEmail();
      const token = await obtainToken(address);
      if (cancelled) return;
      if (token) {
        setAccessToken(token);
        setEmail(address);
        setStatus('signedIn');
      } else {
        setStatus('signedOut');
      }
    }

    void obtain();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // A 401 here means the backend restarted and minted a new signing secret.
    // Signing in again is all it takes, and costs nothing locally.
    setReauthenticate(async () => {
      if (signedOutOnPurpose.current) return null;
      const token = await obtainToken(chosenEmail());
      if (token) setAccessToken(token);
      return token;
    });
    return () => setReauthenticate(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ status, email, signIn, signOut }),
    [status, email, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
