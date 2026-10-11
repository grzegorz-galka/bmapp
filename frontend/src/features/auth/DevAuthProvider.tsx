/**
 * The session, obtained locally instead of from the identity broker.
 *
 * The counterpart of the backend's development mode, and selected the same
 * way: only when the application is explicitly told to. Without it nothing
 * could be signed in to where the broker is unreachable, which is every
 * developer's machine and the end-to-end suite.
 *
 * A person signs in through a login window with an email and the password
 * derived from it. Nothing is signed in on its own: the window opens when the
 * page loads with no session, and again whenever "Sign in" is chosen.
 *
 * The token it obtains is signed with an algorithm a broker-backed server
 * never accepts, so nothing here can reach a deployed one.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AuthContext, type AuthState, type SessionStatus } from './AuthProvider';
import { ApiError, setAccessToken, setReauthenticate, type ApiFieldError } from '../../api/client';
import { DEV_EMAIL_KEY } from './devEmail';
import { DevLoginDialog } from './DevLoginDialog';

export { DEV_EMAIL_KEY };

interface Credentials {
  email: string;
  password: string;
}

/** The email to pre-fill: the last one signed in with, else the configured default. */
function rememberedEmail(): string {
  try {
    const stored = window.localStorage.getItem(DEV_EMAIL_KEY);
    if (stored && stored.trim() !== '') return stored.trim().toLowerCase();
  } catch {
    // Private windows and blocked storage fall through to the default.
  }
  return (import.meta.env.VITE_DEV_EMAIL ?? '').toLowerCase();
}

function remember(email: string): void {
  try {
    window.localStorage.setItem(DEV_EMAIL_KEY, email);
  } catch {
    // Only a convenience: the next window starts empty instead.
  }
}

/**
 * Ask the backend for a token, without going through the shared client.
 *
 * The shared client answers a 401 by reauthenticating, and reauthenticating
 * comes back here - a refusal would loop. Builds the same `ApiError` the
 * client would, so the window translates it like any other form.
 */
async function obtainToken({ email, password }: Credentials): Promise<string | ApiError> {
  const base = import.meta.env.VITE_API_BASE_URL ?? '/api';
  const response = await fetch(`${base}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    errors?: ApiFieldError[];
  };
  if (response.ok && body.access_token) return body.access_token;
  return new ApiError(response.status, body.errors ?? []);
}

/** The normalised email the token was issued for, as the backend normalised it. */
function normalised(email: string): string {
  return email.trim().toLowerCase();
}

export function DevAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('signedOut');
  const [email, setEmail] = useState<string | null>(null);
  const [windowOpen, setWindowOpen] = useState(true);
  const queryClient = useQueryClient();
  // Held in page memory, never in storage, so that a backend restart - which
  // mints a new signing secret and refuses every token - is recovered without
  // asking again. Cleared on sign-out, gone on reload.
  const credentials = useRef<Credentials | null>(null);

  const signIn = useCallback(async () => {
    setWindowOpen(true);
  }, []);

  const signOut = useCallback(async () => {
    credentials.current = null;
    setAccessToken(null);
    setEmail(null);
    setStatus('signedOut');
    // As in the broker-backed provider: what was fetched belonged to whoever
    // has just signed out.
    queryClient.clear();
  }, [queryClient]);

  const submit = useCallback(
    async (address: string, password: string): Promise<Error | null> => {
      let result: string | ApiError;
      try {
        result = await obtainToken({ email: address, password });
      } catch (failure) {
        return failure instanceof Error ? failure : new Error(String(failure));
      }
      if (result instanceof ApiError) return result;

      const signedInAs = normalised(address);
      credentials.current = { email: signedInAs, password };
      setAccessToken(result);
      remember(signedInAs);
      setEmail(signedInAs);
      setStatus('signedIn');
      setWindowOpen(false);
      // Whatever the page asked for while nobody was signed in was refused;
      // ask again as the person who now is.
      void queryClient.resetQueries();
      return null;
    },
    [queryClient],
  );

  useEffect(() => {
    setReauthenticate(async () => {
      if (!credentials.current) return null;
      const result = await obtainToken(credentials.current);
      if (result instanceof ApiError) return null;
      setAccessToken(result);
      return result;
    });
    return () => setReauthenticate(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ status, email, signIn, signOut }),
    [status, email, signIn, signOut],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {windowOpen && status !== 'signedIn' && (
        <DevLoginDialog
          initialEmail={rememberedEmail()}
          onSubmit={submit}
          onClose={() => setWindowOpen(false)}
        />
      )}
    </AuthContext.Provider>
  );
}
