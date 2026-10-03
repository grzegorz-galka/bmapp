/**
 * The identity in the header, and the way out of the session.
 *
 * Replaces the plain text the hub used to show: there is a session behind it
 * now, so offering a sign-out is no longer a lie.
 */
import { useTranslation } from 'react-i18next';
import { useAuth } from '../features/auth/AuthProvider';
import styles from './AppHeader.module.css';

export function AccountControl({ initials }: { initials?: string }) {
  const { t } = useTranslation();
  const { status, email, signIn, signOut } = useAuth();

  if (status === 'restoring') {
    return <p className={styles.identity}>{t('auth.restoring')}</p>;
  }

  if (status !== 'signedIn' || !email) {
    return (
      <p className={styles.identity}>
        <button type="button" onClick={() => void signIn()}>
          {t('auth.signIn')}
        </button>
        {status === 'ended' && <span className="visually-hidden">{t('auth.sessionEnded')}</span>}
      </p>
    );
  }

  return (
    <p className={styles.identity}>
      <span className={styles.avatar} aria-hidden="true">
        {initials ?? email.slice(0, 1).toUpperCase()}
      </span>
      <span className={styles.email}>{email}</span>
      <button
        type="button"
        onClick={() => void signOut()}
        aria-label={t('auth.accountLabel', { email })}
      >
        {t('auth.signOut')}
      </button>
    </p>
  );
}
