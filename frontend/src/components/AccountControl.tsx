/**
 * The identity in the header, and the way out of the session.
 *
 * The person is named by their display name, read from `/auth/me` through
 * `useCurrentUser`. Reading it on every page is deliberate (design D8 of
 * add-dev-accounts-and-employee-names): that request is what stores the
 * broker's name claims, so it has to run after every sign-in, not only on the
 * pages that ask whether someone is an administrator.
 *
 * The email is shown only in the menu, where the address itself is the point.
 * The menu is a disclosure rather than an ARIA menu, as the Configuration
 * group is: what it holds is ordinary content and a button, reached by Tab.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../features/auth/AuthProvider';
import { useCurrentUser } from '../features/auth/useCurrentUser';
import controls from '../styles/controls.module.css';
import styles from './AccountControl.module.css';

export function AccountControl() {
  const { t } = useTranslation();
  const { status, email, signIn, signOut } = useAuth();
  const user = useCurrentUser().data;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

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

  // Until `/auth/me` answers, the token's email is the only identity there is.
  const name = user?.display_name ?? email;
  const initials = user?.initials ?? email.slice(0, 1).toUpperCase();

  return (
    <div
      ref={root}
      className={styles.account}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          setOpen(false);
          root.current?.querySelector('button')?.focus();
        }
      }}
    >
      <button
        type="button"
        className={`${styles.identity} ${styles.trigger}`}
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={t('auth.accountLabel', { name })}
        onClick={() => setOpen(!open)}
      >
        <span className={styles.avatar} aria-hidden="true">
          {initials}
        </span>
        <span className={styles.name}>{name}</span>
        <span className={styles.caret} aria-hidden="true" />
      </button>
      {open && (
        <div id="account-menu" className={styles.menu}>
          <p className={styles.email}>{email}</p>
          <button type="button" className={controls.button} onClick={() => void signOut()}>
            {t('auth.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}
