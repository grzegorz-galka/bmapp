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
import { DevLoginDialog } from './DevLoginDialog';
import { stubDialog } from './dialogStub';

beforeAll(stubDialog);

type Submit = (email: string, password: string) => Promise<Error | null>;

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
});
