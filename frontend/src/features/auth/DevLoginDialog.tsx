/**
 * The login window of development mode, in two steps.
 *
 * First an email and a password. A first sign-in, made with the password
 * derived from the email, is answered with no token; the window then asks for
 * a password of the person's own, twice, with their name and surname filled in
 * from the proposal, and only that step signs them in.
 *
 * Rendered only by `DevAuthProvider`, and only while it is open, so each
 * opening starts from the remembered email and an empty password. A native
 * `<dialog>` shown with `showModal()` gives the backdrop, the focus trap and
 * Escape-to-close without a dependency.
 *
 * The password is never worked out here, and no text says how it is: if it
 * were, the window could fill itself in and would serve no purpose.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { describeFieldFailure, describeOtherFailure } from '../../i18n/apiErrors';
import controls from '../../styles/controls.module.css';
import styles from './DevLoginDialog.module.css';

const SIGN_IN_FIELDS = ['email', 'password'] as const;
// `password` is the current password, which this step does not show: a refusal
// of it belongs in the general message, not beside a field.
const SET_PASSWORD_FIELDS = ['email', 'new_password', 'name', 'surname'] as const;

/** A first sign-in waiting for its password to be chosen. */
export interface PendingChange {
  email: string;
  /** The password the person signed in with, sent back as the current one. */
  password: string;
  /** The proposal to prefill; null hides the field. */
  name: string | null;
  surname: string | null;
}

interface Props {
  initialEmail: string;
  /** Set once a first sign-in asks for a new password: the window's second step. */
  pending?: PendingChange | null;
  /** Resolves to nothing on success, or to the refusal to show. */
  onSubmit: (email: string, password: string) => Promise<Error | null>;
  /** Resolves to nothing on success, or to the refusal to show. */
  onSetPassword?: (
    newPassword: string,
    name: string | null,
    surname: string | null,
  ) => Promise<Error | null>;
  onClose: () => void;
}

export function DevLoginDialog({
  initialEmail,
  pending = null,
  onSubmit,
  onSetPassword,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => {
      if (element?.open) element.close();
    };
  }, []);

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
      {pending ? (
        <SetPasswordStep
          key={pending.email}
          pending={pending}
          onSetPassword={onSetPassword ?? (async () => null)}
          onClose={onClose}
        />
      ) : (
        <SignInStep initialEmail={initialEmail} onSubmit={onSubmit} onClose={onClose} />
      )}
    </dialog>
  );
}

function SignInStep({
  initialEmail,
  onSubmit,
  onClose,
}: Pick<Props, 'initialEmail' | 'onSubmit' | 'onClose'>) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [failure, setFailure] = useState<Error | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    const refusal = await onSubmit(email, password);
    setSubmitting(false);
    setFailure(refusal);
  }

  const emailError = describeFieldFailure(t, failure, 'email');
  const passwordError = describeFieldFailure(t, failure, 'password');
  const otherError = describeOtherFailure(t, failure, SIGN_IN_FIELDS);

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      <h2 id="dev-login-title" className={styles.title}>
        {t('auth.devLoginTitle')}
      </h2>

      <Field
        id="dev-login-email"
        name="email"
        label={t('auth.devLoginEmail')}
        type="email"
        autoComplete="username"
        value={email}
        onChange={setEmail}
        error={emailError}
        autoFocus={initialEmail === ''}
      />
      <Field
        id="dev-login-password"
        name="password"
        label={t('auth.devLoginPassword')}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        error={passwordError}
        autoFocus={initialEmail !== ''}
      />

      {otherError && (
        <p className={styles.error} role="alert">
          {otherError}
        </p>
      )}

      <div className={styles.actions}>
        <button type="button" className={controls.button} onClick={onClose}>
          {t('auth.devLoginClose')}
        </button>
        <button type="submit" className={controls.default} disabled={submitting}>
          {submitting ? t('auth.devLoginSubmitting') : t('auth.devLoginSubmit')}
        </button>
      </div>
    </form>
  );
}

function SetPasswordStep({
  pending,
  onSetPassword,
  onClose,
}: {
  pending: PendingChange;
  onSetPassword: NonNullable<Props['onSetPassword']>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(pending.name ?? '');
  const [surname, setSurname] = useState(pending.surname ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [repeated, setRepeated] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [failure, setFailure] = useState<Error | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    // Caught here so that a typo never reaches the server as the new password.
    if (newPassword !== repeated) {
      setMismatch(true);
      setFailure(null);
      return;
    }
    setMismatch(false);
    setSubmitting(true);
    const refusal = await onSetPassword(
      newPassword,
      pending.name === null ? null : name,
      pending.surname === null ? null : surname,
    );
    setSubmitting(false);
    setFailure(refusal);
  }

  const emailError = describeFieldFailure(t, failure, 'email');
  const nameError = describeFieldFailure(t, failure, 'name');
  const surnameError = describeFieldFailure(t, failure, 'surname');
  const newPasswordError = describeFieldFailure(t, failure, 'new_password');
  const otherError = describeOtherFailure(t, failure, SET_PASSWORD_FIELDS);

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      <h2 id="dev-login-title" className={styles.title}>
        {t('auth.devLoginTitle')}
      </h2>
      <p className={styles.intro}>{t('auth.devPasswordIntro')}</p>

      <Field
        id="dev-password-email"
        name="email"
        label={t('auth.devLoginEmail')}
        type="email"
        autoComplete="username"
        value={pending.email}
        readOnly
        error={emailError}
      />
      {pending.name !== null && (
        <Field
          id="dev-password-name"
          name="name"
          label={t('auth.devPasswordName')}
          type="text"
          autoComplete="given-name"
          value={name}
          onChange={setName}
          error={nameError}
        />
      )}
      {pending.surname !== null && (
        <Field
          id="dev-password-surname"
          name="surname"
          label={t('auth.devPasswordSurname')}
          type="text"
          autoComplete="family-name"
          value={surname}
          onChange={setSurname}
          error={surnameError}
        />
      )}
      <Field
        id="dev-password-new"
        name="new_password"
        label={t('auth.devPasswordNew')}
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={setNewPassword}
        error={newPasswordError}
        autoFocus
      />
      <Field
        id="dev-password-repeat"
        name="repeat_password"
        label={t('auth.devPasswordRepeat')}
        type="password"
        autoComplete="new-password"
        value={repeated}
        onChange={setRepeated}
        error={mismatch ? t('auth.passwordMismatch') : undefined}
      />

      {otherError && (
        <p className={styles.error} role="alert">
          {otherError}
        </p>
      )}

      <div className={styles.actions}>
        <button type="button" className={controls.button} onClick={onClose}>
          {t('auth.devLoginClose')}
        </button>
        <button type="submit" className={controls.default} disabled={submitting}>
          {submitting ? t('auth.devPasswordSubmitting') : t('auth.devPasswordSubmit')}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  type,
  autoComplete,
  value,
  onChange,
  error,
  readOnly = false,
  autoFocus = false,
}: {
  id: string;
  /** The form field name, which the end-to-end helpers fill the window by. */
  name: string;
  label: string;
  type: 'email' | 'password' | 'text';
  autoComplete: string;
  value: string;
  onChange?: (value: string) => void;
  error: string | undefined;
  readOnly?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        className={styles.input}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        readOnly={readOnly}
        aria-invalid={error !== undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        autoFocus={autoFocus}
      />
      {error && (
        <span id={`${id}-error`} className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}
