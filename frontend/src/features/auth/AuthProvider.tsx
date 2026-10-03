/**
 * The session: who is signed in, and how that changes.
 *
 * Tokens live here and nowhere else. The access token is handed to the API
 * client through a setter rather than read from storage, so there is exactly
 * one place that holds it and it goes away with the page.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User, UserManager } from 'oidc-client-ts';
import { createUserManager } from './config';
import { setAccessToken, setReauthenticate } from '../../api/client';

export type SessionStatus = 'restoring' | 'signedIn' | 'signedOut' | 'ended';

export interface AuthState {
  status: SessionStatus;
  /** The email the token names, once there is one. */
  email: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

/** Exported so a test can state who is viewing without a broker. */
export const AuthContext = createContext<AuthState | null>(null);

function emailOf(user: User | null): string | null {
  const claim = user?.profile?.email;
  return typeof claim === 'string' && claim.trim() !== '' ? claim.trim().toLowerCase() : null;
}

export function AuthProvider({
  children,
  userManager,
}: {
  children: ReactNode;
  /** Injected by tests; the application builds its own. */
  userManager?: UserManager;
}) {
  // A lazy initial state rather than a ref: the manager must be built once
  // and never during a re-render, and reading a ref while rendering is what
  // the React rules forbid.
  const [manager] = useState<UserManager>(() => userManager ?? createUserManager());

  const [status, setStatus] = useState<SessionStatus>('restoring');
  const [email, setEmail] = useState<string | null>(null);
  const queryClient = useQueryClient();
  // Set when the person signs out on purpose, so that a 401 arriving from a
  // request already in flight does not quietly renew the session they just
  // ended.
  const signedOutOnPurpose = useRef(false);

  const adopt = useCallback((user: User | null) => {
    const address = emailOf(user);
    if (user?.access_token && address) {
      setAccessToken(user.access_token);
      setEmail(address);
      setStatus('signedIn');
      return true;
    }
    return false;
  }, []);

  const forget = useCallback(
    (next: SessionStatus) => {
      setAccessToken(null);
      setEmail(null);
      setStatus(next);
      // Everything fetched belonged to the person who has just gone. Leaving
      // it cached would show one person's board to the next one to sign in on
      // this browser, and would leave their email on the page after they
      // signed out.
      queryClient.clear();
    },
    [queryClient],
  );

  const signIn = useCallback(async () => {
    await manager.signinRedirect();
  }, [manager]);

  const signOut = useCallback(async () => {
    signedOutOnPurpose.current = true;
    forget('signedOut');
    // Ends the session at the broker as well, so returning to the application
    // does not sign the same person straight back in.
    await manager.signoutRedirect();
  }, [manager, forget]);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const stored = await manager.getUser();
      if (cancelled) return;
      if (adopt(stored)) return;
      try {
        // The browser still holds the broker's cookie after a reload, so the
        // session can come back without the person being asked anything.
        const renewed = await manager.signinSilent();
        if (!cancelled && !adopt(renewed)) forget('signedOut');
      } catch {
        if (!cancelled) forget('signedOut');
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [manager, adopt, forget]);

  useEffect(() => {
    const onRenewed = (user: User) => void adopt(user);
    // Raised when a silent renewal fails: the session is over, and saying so
    // is required rather than retrying in the background forever.
    const onRenewError = () => forget('ended');
    const onUnloaded = () => forget('signedOut');

    manager.events.addUserLoaded(onRenewed);
    manager.events.addSilentRenewError(onRenewError);
    manager.events.addUserUnloaded(onUnloaded);
    return () => {
      manager.events.removeUserLoaded(onRenewed);
      manager.events.removeSilentRenewError(onRenewError);
      manager.events.removeUserUnloaded(onUnloaded);
    };
  }, [manager, adopt, forget]);

  useEffect(() => {
    // A 401 from any request means the token the page holds is no longer
    // good. One silent renewal is attempted; if that fails the session ended.
    setReauthenticate(async () => {
      if (signedOutOnPurpose.current) return null;
      try {
        const renewed = await manager.signinSilent();
        if (renewed?.access_token && adopt(renewed)) return renewed.access_token;
      } catch {
        // Falls through to ending the session.
      }
      forget('ended');
      return null;
    });
    return () => setReauthenticate(null);
  }, [manager, adopt, forget]);

  const value = useMemo<AuthState>(
    () => ({ status, email, signIn, signOut }),
    [status, email, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return value;
}
