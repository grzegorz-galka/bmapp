/**
 * Where the identity broker sends the browser back to.
 *
 * Completing the sign-in is also what proves the response belongs to the
 * request this page started: the library compares the returned state against
 * the one it stored, and rejects a response that does not match.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthProvider';

export function AuthCallbackPage({ complete }: { complete: () => Promise<boolean> }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status } = useAuth();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void complete()
      .then((ok) => {
        if (cancelled) return;
        if (ok) navigate('/', { replace: true });
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [complete, navigate]);

  if (failed) {
    return (
      <main>
        <h1>{t('auth.signInFailedTitle')}</h1>
        <p>{t('auth.signInFailed')}</p>
      </main>
    );
  }

  return (
    <main>
      <p role="status">{t(status === 'signedIn' ? 'auth.signedIn' : 'auth.completing')}</p>
    </main>
  );
}
