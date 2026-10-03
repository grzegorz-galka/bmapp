import { useCallback, useState } from 'react';
import { UserManager } from 'oidc-client-ts';
import { AppRoutes } from './routes';
import { AuthProvider } from './features/auth/AuthProvider';
import { DevAuthProvider } from './features/auth/DevAuthProvider';
import { createUserManager } from './features/auth/config';

/**
 * Whether to obtain a session locally instead of from the identity broker.
 * Set only in local development; a deployed build has no broker-less path.
 */
const USE_DEV_SESSION = import.meta.env.VITE_AUTH_MODE === 'dev';

/**
 * The application, with the session wrapped around every page.
 *
 * The user manager is built once and shared: the provider needs it to restore
 * and renew, and the callback route needs the same instance to complete a
 * sign-in against the state that instance stored.
 */
export function App({ userManager }: { userManager?: UserManager } = {}) {
  const [manager] = useState<UserManager>(() => userManager ?? createUserManager());

  const completeSignIn = useCallback(async () => {
    // Throws when the returned state does not match the one stored for the
    // sign-in this page started, which is what makes a mismatched response
    // land on the failure path rather than signing anybody in.
    const user = await manager.signinCallback(window.location.href);
    return Boolean(user?.access_token);
  }, [manager]);

  if (USE_DEV_SESSION) {
    return (
      <DevAuthProvider>
        <AppRoutes completeSignIn={completeSignIn} />
      </DevAuthProvider>
    );
  }

  return (
    <AuthProvider userManager={manager}>
      <AppRoutes completeSignIn={completeSignIn} />
    </AuthProvider>
  );
}
