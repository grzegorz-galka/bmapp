/**
 * The development login window on its own: what it sends, how it shows a
 * refusal, and how it closes. The session around it is `DevAuthProvider`'s,
 * tested there.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import { ApiError } from '../../api/client';
import { DevLoginDialog, type PendingChange } from './DevLoginDialog';
import { stubDialog } from './dialogStub';

beforeAll(stubDialog);

type Submit = (email: string, password: string) => Promise<Error | null>;
type SetPassword = (
  newPassword: string,
  name: string | null,
  surname: string | null,
) => Promise<Error | null>;

const JAN: PendingChange = {
  email: 'jan.kowalski@example.com',
  password: 'jakoexco',
  name: 'Jan',
  surname: 'Kowalski',
};
const ADMIN: PendingChange = {
  email: 'admin@pse.pl',
  password: 'adpspl',
  name: null,
  surname: null,
};

/** The window at its second step, as a first sign-in leaves it. */
function atNewPassword(
  pending: PendingChange = JAN,
  onSetPassword = vi.fn<SetPassword>(async () => null),
  onClose = vi.fn(),
) {
  const onSubmit = vi.fn<Submit>(async () => null);
  return { initialEmail: pending.email, pending, onSubmit, onSetPassword, onClose };
}

async function chooseTwice(first: string, second = first) {
  await userEvent.type(screen.getByLabelText(en.auth.devPasswordNew), first);
  await userEvent.type(screen.getByLabelText(en.auth.devPasswordRepeat), second);
  await userEvent.click(screen.getByRole('button', { name: en.auth.devPasswordSubmit }));
}

function open(onSubmit = vi.fn<Submit>(async () => null), onClose = vi.fn(), initialEmail = '') {
  return { onSubmit, onClose, initialEmail };
}

describe('DevLoginDialog', () => {
  it('asks for an email and a password, with the email pre-filled', async () => {
    const props = open(undefined, undefined, 'grzegorz.galka@pse.pl');
    await renderWithLanguage(<DevLoginDialog {...props} />, 'en');

    expect(screen.getByRole('dialog', { name: en.auth.devLoginTitle })).toBeInTheDocument();
    expect(screen.getByLabelText(en.auth.devLoginEmail)).toHaveValue('grzegorz.galka@pse.pl');
    expect(screen.getByLabelText(en.auth.devLoginPassword)).toHaveValue('');
  });

  it('the window does not say how the password is derived', async () => {
    for (const [language, catalogue] of [
      ['en', en],
      ['pl', pl],
    ] as const) {
      for (const pending of [null, JAN]) {
        const { unmount } = await renderWithLanguage(
          <DevLoginDialog {...open()} pending={pending} />,
          language,
        );

        const window = screen.getByRole('dialog', { name: catalogue.auth.devLoginTitle });
        expect(screen.getByLabelText(catalogue.auth.devLoginEmail)).toBeInTheDocument();
        if (pending) {
          expect(screen.getByLabelText(catalogue.auth.devPasswordNew)).toBeInTheDocument();
          expect(screen.getByLabelText(catalogue.auth.devPasswordRepeat)).toBeInTheDocument();
          expect(
            screen.getByRole('button', { name: catalogue.auth.devPasswordSubmit }),
          ).toBeInTheDocument();
        } else {
          expect(screen.getByLabelText(catalogue.auth.devLoginPassword)).toBeInTheDocument();
          expect(
            screen.getByRole('button', { name: catalogue.auth.devLoginSubmit }),
          ).toBeInTheDocument();
        }
        expect(window).not.toHaveTextContent(
          /grgapspl|jakoexco|first two characters|pierwsze dwa znaki|derived|wyprowadz/i,
        );
        unmount();
      }
    }
  });

  it('submits what was typed', async () => {
    const props = open();
    await renderWithLanguage(<DevLoginDialog {...props} />, 'en');

    await userEvent.type(screen.getByLabelText(en.auth.devLoginEmail), 'admin@company.com');
    await userEvent.type(screen.getByLabelText(en.auth.devLoginPassword), 'adcoco');
    await userEvent.click(screen.getByRole('button', { name: en.auth.devLoginSubmit }));

    expect(props.onSubmit).toHaveBeenCalledWith('admin@company.com', 'adcoco');
  });

  it('shows a refusal beside the field it concerns, in the active language', async () => {
    const refusal = new ApiError(401, [
      { field: 'password', code: 'auth.password_incorrect', message: 'Wrong.' },
    ]);
    const props = open(
      vi.fn(async () => refusal),
      undefined,
      'admin@company.com',
    );
    await renderWithLanguage(<DevLoginDialog {...props} />, 'pl');

    await userEvent.type(screen.getByLabelText(pl.auth.devLoginPassword), 'nope');
    await userEvent.click(screen.getByRole('button', { name: pl.auth.devLoginSubmit }));

    const password = screen.getByLabelText(pl.auth.devLoginPassword);
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(password).toHaveAccessibleDescription(pl.errors['auth.password_incorrect']);
    expect(screen.getByLabelText(pl.auth.devLoginEmail)).toHaveAttribute('aria-invalid', 'false');
  });

  it('shows an unknown employee against the email', async () => {
    const refusal = new ApiError(401, [
      { field: 'email', code: 'auth.employee_unknown', message: 'Unknown.' },
    ]);
    const props = open(
      vi.fn(async () => refusal),
      undefined,
      'nobody@pse.pl',
    );
    await renderWithLanguage(<DevLoginDialog {...props} />, 'en');

    await userEvent.type(screen.getByLabelText(en.auth.devLoginPassword), 'npp');
    await userEvent.click(screen.getByRole('button', { name: en.auth.devLoginSubmit }));

    expect(screen.getByLabelText(en.auth.devLoginEmail)).toHaveAccessibleDescription(
      en.errors['auth.employee_unknown'],
    );
  });

  it('says something when the request fails without a field to blame', async () => {
    const props = open(vi.fn<Submit>(async () => new Error('Network down')));
    await renderWithLanguage(<DevLoginDialog {...props} />, 'en');

    await userEvent.click(screen.getByRole('button', { name: en.auth.devLoginSubmit }));

    expect(screen.getByRole('alert')).toHaveTextContent(en.errors.generic);
  });

  it('closes through the close button', async () => {
    const props = open();
    await renderWithLanguage(<DevLoginDialog {...props} />, 'en');

    await userEvent.click(screen.getByRole('button', { name: en.auth.devLoginClose }));

    expect(props.onClose).toHaveBeenCalled();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const props = open();
    await renderWithLanguage(<DevLoginDialog {...props} />, 'en');

    screen
      .getByRole('dialog')
      .dispatchEvent(new Event('cancel', { bubbles: false, cancelable: true }));

    expect(props.onClose).toHaveBeenCalled();
  });

  it('the window asks for a password, name and surname', async () => {
    await renderWithLanguage(<DevLoginDialog {...atNewPassword()} />, 'en');

    const email = screen.getByLabelText(en.auth.devLoginEmail);
    expect(email).toHaveValue(JAN.email);
    expect(email).toHaveAttribute('readonly');
    expect(screen.getByLabelText(en.auth.devPasswordName)).toHaveValue('Jan');
    expect(screen.getByLabelText(en.auth.devPasswordSurname)).toHaveValue('Kowalski');
    expect(screen.getByLabelText(en.auth.devPasswordNew)).toHaveValue('');
    expect(screen.getByLabelText(en.auth.devPasswordRepeat)).toHaveValue('');
    expect(screen.queryByLabelText(en.auth.devLoginPassword)).not.toBeInTheDocument();
  });

  it('setting the password in the window signs the person in', async () => {
    const props = atNewPassword();
    await renderWithLanguage(<DevLoginDialog {...props} />, 'en');

    const surname = screen.getByLabelText(en.auth.devPasswordSurname);
    await userEvent.clear(surname);
    await userEvent.type(surname, 'Kowalska');
    await chooseTwice('correct horse');

    expect(props.onSetPassword).toHaveBeenCalledWith('correct horse', 'Jan', 'Kowalska');
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('unequal passwords are refused in the window', async () => {
    const props = atNewPassword();
    await renderWithLanguage(<DevLoginDialog {...props} />, 'pl');

    await userEvent.type(screen.getByLabelText(pl.auth.devPasswordNew), 'correct horse');
    await userEvent.type(screen.getByLabelText(pl.auth.devPasswordRepeat), 'correct hose');
    await userEvent.click(screen.getByRole('button', { name: pl.auth.devPasswordSubmit }));

    expect(props.onSetPassword).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const repeat = screen.getByLabelText(pl.auth.devPasswordRepeat);
    expect(repeat).toHaveAttribute('aria-invalid', 'true');
    expect(repeat).toHaveAccessibleDescription(pl.auth.passwordMismatch);
  });

  it('an administrator with no record is asked only for a password', async () => {
    const props = atNewPassword(ADMIN);
    await renderWithLanguage(<DevLoginDialog {...props} />, 'en');

    expect(screen.queryByLabelText(en.auth.devPasswordName)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(en.auth.devPasswordSurname)).not.toBeInTheDocument();
    await chooseTwice('correct horse');

    expect(props.onSetPassword).toHaveBeenCalledWith('correct horse', null, null);
  });

  it('closing the window at the new password step stores nothing', async () => {
    const props = atNewPassword();
    await renderWithLanguage(<DevLoginDialog {...props} />, 'en');
    await userEvent.type(screen.getByLabelText(en.auth.devPasswordNew), 'correct horse');

    await userEvent.click(screen.getByRole('button', { name: en.auth.devLoginClose }));

    expect(props.onClose).toHaveBeenCalled();
    expect(props.onSetPassword).not.toHaveBeenCalled();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it.each([
    ['new_password', 'dev_password.too_short', en.auth.devPasswordNew],
    ['new_password', 'dev_password.unchanged', en.auth.devPasswordNew],
    ['name', 'employee_name.too_long', en.auth.devPasswordName],
    ['surname', 'employee_name.too_long', en.auth.devPasswordSurname],
  ] as const)(
    'shows a refusal of %s (%s) beside the field, translated',
    async (field, code, label) => {
      const refusal = new ApiError(422, [{ field, code, message: 'x' }]);
      const props = atNewPassword(
        JAN,
        vi.fn<SetPassword>(async () => refusal),
      );
      await renderWithLanguage(<DevLoginDialog {...props} />, 'en');

      await chooseTwice('correct horse');

      const input = screen.getByLabelText(label);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAccessibleDescription(en.errors[code]);
    },
  );

  it('shows a refused current password as a general message at the new password step', async () => {
    const refusal = new ApiError(401, [
      { field: 'password', code: 'auth.password_incorrect', message: 'x' },
    ]);
    const props = atNewPassword(
      JAN,
      vi.fn<SetPassword>(async () => refusal),
    );
    await renderWithLanguage(<DevLoginDialog {...props} />, 'pl');

    await userEvent.type(screen.getByLabelText(pl.auth.devPasswordNew), 'correct horse');
    await userEvent.type(screen.getByLabelText(pl.auth.devPasswordRepeat), 'correct horse');
    await userEvent.click(screen.getByRole('button', { name: pl.auth.devPasswordSubmit }));

    expect(screen.getByRole('alert')).toHaveTextContent(pl.errors['auth.password_incorrect']);
  });
});
