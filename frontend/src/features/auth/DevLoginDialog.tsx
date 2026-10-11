/**
 * The login window of development mode: an email and the password derived
 * from it.
 *
 * Rendered only by `DevAuthProvider`, and only while it is open, so each
 * opening starts from the remembered email and an empty password. A native
 * `<dialog>` shown with `showModal()` gives the backdrop, the focus trap and
 * Escape-to-close without a dependency.
 *
 * The password is never worked out here. If it were, the window could fill
 * itself in and would serve no purpose.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { describeFieldFailure, describeOtherFailure } from '../../i18n/apiErrors';
import styles from './DevLoginDialog.module.css';

const FIELDS = ['email', 'password'] as const;

interface Props {
  initialEmail: string;
  /** Resolves to nothing on success, or to the refusal to show. */
  onSubmit: (email: string, password: string) => Promise<Error | null>;
  onClose: () => void;
}

export function DevLoginDialog({ initialEmail, onSubmit, onClose }: Props) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [failure, setFailure] = useState<Error | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => {
      if (element?.open) element.close();
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    const refusal = await onSubmit(email, password);
    setSubmitting(false);
    setFailure(refusal);
  }

  const emailError = describeFieldFailure(t, failure, 'email');
  const passwordError = describeFieldFailure(t, failure, 'password');
  const otherError = describeOtherFailure(t, failure, FIELDS);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="dev-login-title"
      onCancel={(event) => {
        // Escape: let React decide, so the window closes through the same path
        // as the close button.
        event.preventDefault();
        onClose();
      }}
    >
      <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        <h2 id="dev-login-title" className={styles.title}>
          {t('auth.devLoginTitle')}
        </h2>
        <p className={styles.hint}>{t('auth.devLoginHint')}</p>

        <div className={styles.field}>
          <label htmlFor="dev-login-email" className={styles.label}>
            {t('auth.devLoginEmail')}
          </label>
          <input
            id="dev-login-email"
            className={styles.input}
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={emailError !== undefined}
            aria-describedby={emailError ? 'dev-login-email-error' : undefined}
            autoFocus={initialEmail === ''}
          />
          {emailError && (
            <span id="dev-login-email-error" className={styles.error}>
              {emailError}
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="dev-login-password" className={styles.label}>
            {t('auth.devLoginPassword')}
          </label>
          <input
            id="dev-login-password"
            className={styles.input}
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={passwordError !== undefined}
            aria-describedby={passwordError ? 'dev-login-password-error' : undefined}
            autoFocus={initialEmail !== ''}
          />
          {passwordError && (
            <span id="dev-login-password-error" className={styles.error}>
              {passwordError}
            </span>
          )}
        </div>

        {otherError && (
          <p className={styles.error} role="alert">
            {otherError}
          </p>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={onClose}>
            {t('auth.devLoginClose')}
          </button>
          <button type="submit" className={styles.primary} disabled={submitting}>
            {submitting ? t('auth.devLoginSubmitting') : t('auth.devLoginSubmit')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
