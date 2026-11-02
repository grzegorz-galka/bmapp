/**
 * The session, obtained locally instead of from the identity broker.
 *
 * The counterpart of the backend's development mode, and selected the same
 * way: only when the application is explicitly told to. Without it nothing
 * could be signed in to where the broker is unreachable, which is every
 * developer's machine and the end-to-end suite.
 *
 * A person signs in through a login window with an email and a password. The
 * first sign-in, with the password derived from the email, issues no token: the
 * window moves on to choosing a password, with the name and surname, and only
 * that step signs the person in. Nothing is signed in on its own: the window opens when the
 * page loads with no session, after signing out, and whenever "Sign in" is
 * chosen.
 *
 * The token it obtains is signed with an algorithm a broker-backed server
 * never accepts, so nothing here can reach a deployed one.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AuthContext, type AuthState, type SessionStatus } from './AuthProvider';
import { ApiError, setAccessToken, setReauthenticate } from '../../api/client';
import { devLogin, isPasswordChangeRequired, setDevPassword } from '../../api/auth';
import { DEV_EMAIL_KEY } from './devEmail';
import { DevLoginDialog, type PendingChange } from './DevLoginDialog';

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
 * Sign in with what the window was given. Resolves to the token, or to the
 * proposal of a first sign-in, which needs a password chosen before any token.
 */
async function obtainToken({ email, password }: Credentials): Promise<string | PendingChange> {
  const response = await devLogin(email, password);
  if (!isPasswordChangeRequired(response)) return response.access_token;
  return { email: normalised(email), password, name: response.name, surname: response.surname };
}

/** The normalised email the token was issued for, as the backend normalised it. */
function normalised(email: string): string {
  return email.trim().toLowerCase();
}

export function DevAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('signedOut');
  const [email, setEmail] = useState<string | null>(null);
  const [windowOpen, setWindowOpen] = useState(true);
  // The first sign-in waiting for its password. Page memory only: closing the
  // window drops it, and nothing has been stored by then.
  const [pending, setPending] = useState<PendingChange | null>(null);
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
    // As on a page loaded with no session: the window is the way back in, and
    // it is drawn over the signed-out panel.
    setWindowOpen(true);
    // As in the broker-backed provider: what was fetched belonged to whoever
    // has just signed out.
    queryClient.clear();
  }, [queryClient]);

  const finish = useCallback(
    (signedInAs: string, password: string, token: string) => {
      credentials.current = { email: signedInAs, password };
      setAccessToken(token);
      remember(signedInAs);
      setEmail(signedInAs);
      setPending(null);
      setStatus('signedIn');
      setWindowOpen(false);
      // Whatever the page asked for while nobody was signed in was refused;
      // ask again as the person who now is.
      void queryClient.resetQueries();
    },
    [queryClient],
  );

  const submit = useCallback(
    async (address: string, password: string): Promise<Error | null> => {
      let result: string | PendingChange;
      try {
        result = await obtainToken({ email: address, password });
      } catch (failure) {
        return failure instanceof Error ? failure : new Error(String(failure));
      }
      if (typeof result !== 'string') {
        setPending(result);
        return null;
      }
      finish(normalised(address), password, result);
      return null;
    },
    [finish],
  );

  const choosePassword = useCallback(
    async (newPassword: string, name: string | null, surname: string | null) => {
      if (!pending) return null;
      try {
        const { access_token } = await setDevPassword({
          email: pending.email,
          current_password: pending.password,
          new_password: newPassword,
          name,
          surname,
        });
        finish(pending.email, newPassword, access_token);
        return null;
      } catch (failure) {
        return failure instanceof Error ? failure : new Error(String(failure));
      }
    },
    [pending, finish],
  );

  const close = useCallback(() => {
    setPending(null);
    setWindowOpen(false);
  }, []);

  useEffect(() => {
    setReauthenticate(async () => {
      if (!credentials.current) return null;
      try {
        const result = await obtainToken(credentials.current);
        if (typeof result !== 'string') return null;
        setAccessToken(result);
        return result;
      } catch (failure) {
        // A refusal ends the session; anything else fails the request as before.
        if (failure instanceof ApiError) return null;
        throw failure;
      }
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
          pending={pending}
          onSubmit={submit}
          onSetPassword={choosePassword}
          onClose={close}
        />
      )}
    </AuthContext.Provider>
  );
}
