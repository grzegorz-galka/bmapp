/**
 * Requirement: development mode signs in through a login window.
 *
 * The backend is substituted at `fetch`: these tests are about what the
 * provider does with what `/auth/dev-login` answers, not about the rule that
 * decides the answer, which the backend's own tests pin.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../../i18n';
import { en } from '../../i18n/en';
import { request, resetAuthForTests } from '../../api/client';
import { useAuth } from './AuthProvider';
import { DEV_EMAIL_KEY, DevAuthProvider } from './DevAuthProvider';
import { stubDialog } from './dialogStub';

const EMAIL = 'grzegorz.galka@pse.pl';
const PASSWORD = 'grgapspl';
// A second account, not yet signed in to: its derived password asks for a new one.
const NEW_EMAIL = 'jan.kowalski@example.com';
const DERIVED = 'jakoexco';
const CHOSEN = 'correct horse';

beforeAll(stubDialog);

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  resetAuthForTests();
  vi.restoreAllMocks();
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * A backend whose dev-login accepts EMAIL with PASSWORD, issuing `token-N`.
 * NEW_EMAIL has chosen no password yet: DERIVED asks for one, which
 * dev-password sets, and from then on only that one signs in.
 */
function fakeBackend() {
  let issued = 0;
  let chosen: string | null = null;
  const token = () => {
    issued += 1;
    return json(200, { access_token: `token-${issued}`, token_type: 'Bearer' });
  };
  const refused = (field: string, code: string) =>
    json(401, { errors: [{ field, code, message: 'x' }] });
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/auth/dev-login')) {
      const { email, password } = JSON.parse(String(init?.body)) as Record<string, string>;
      const address = (email ?? '').trim().toLowerCase();
      if (address === NEW_EMAIL) {
        if (chosen === null && password === DERIVED) {
          return json(200, { password_change_required: true, name: 'Jan', surname: 'Kowalski' });
        }
        if (chosen !== null && password === chosen) return token();
        return refused('password', 'auth.password_incorrect');
      }
      if (password !== PASSWORD) return refused('password', 'auth.password_incorrect');
      if (address !== EMAIL) return refused('email', 'auth.employee_unknown');
      return token();
    }
    if (url.endsWith('/auth/dev-password')) {
      const body = JSON.parse(String(init?.body)) as Record<string, string>;
      if (body.email !== NEW_EMAIL || body.current_password !== DERIVED) {
        return refused('password', 'auth.password_incorrect');
      }
      chosen = body.new_password ?? null;
      return token();
    }
    return json(404, { errors: [] });
  });
}

function devPasswordCalls(backend: ReturnType<typeof fakeBackend>) {
  return backend.mock.calls.filter(([url]) => String(url).endsWith('/auth/dev-password'));
}

function Probe() {
  const { status, email, signIn, signOut } = useAuth();
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="email">{email ?? '(nobody)'}</p>
      <button type="button" onClick={() => void signIn()}>
        {en.auth.signIn}
      </button>
      <button type="button" onClick={() => void signOut()}>
        {en.auth.signOut}
      </button>
    </div>
  );
}

async function renderSession() {
  await i18n.changeLanguage('en');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <DevAuthProvider>
          <Probe />
        </DevAuthProvider>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

function loginWindow() {
  return screen.queryByRole('dialog', { name: en.auth.devLoginTitle });
}

async function signInThroughTheWindow(email = EMAIL, password = PASSWORD) {
  const emailField = screen.getByLabelText(en.auth.devLoginEmail);
  await userEvent.clear(emailField);
  await userEvent.type(emailField, email);
  await userEvent.type(screen.getByLabelText(en.auth.devLoginPassword), password);
  await userEvent.click(
    within(loginWindow()!).getByRole('button', { name: en.auth.devLoginSubmit }),
  );
}

describe('DevAuthProvider', () => {
  it('opens the window on a page with no session, and signs nobody in by itself', async () => {
    const backend = fakeBackend();
    await renderSession();

    expect(loginWindow()).toBeInTheDocument();
    expect(screen.getByTestId('status')).toHaveTextContent('signedOut');
    expect(backend).not.toHaveBeenCalled();
  });

  it('signs a person in through the window', async () => {
    fakeBackend();
    await renderSession();

    await signInThroughTheWindow();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));
    expect(screen.getByTestId('email')).toHaveTextContent(EMAIL);
    expect(loginWindow()).not.toBeInTheDocument();
  });

  it('sends the token it obtained with every request', async () => {
    const backend = fakeBackend();
    await renderSession();
    await signInThroughTheWindow();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));

    await request('/dashboard').catch(() => undefined);

    const [, init] = backend.mock.calls.at(-1)!;
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
  });

  it('keeps the window open and stays signed out on a refusal', async () => {
    fakeBackend();
    await renderSession();

    await signInThroughTheWindow(EMAIL, 'wrong');

    expect(
      await screen.findByText(en.errors['auth.password_incorrect'], { exact: true }),
    ).toBeInTheDocument();
    expect(loginWindow()).toBeInTheDocument();
    expect(screen.getByTestId('status')).toHaveTextContent('signedOut');
  });

  it('leaves the person signed out when the window is closed, and reopens it on sign-in', async () => {
    fakeBackend();
    await renderSession();

    await userEvent.click(screen.getByRole('button', { name: en.auth.devLoginClose }));

    expect(loginWindow()).not.toBeInTheDocument();
    expect(screen.getByTestId('status')).toHaveTextContent('signedOut');

    await userEvent.click(screen.getByRole('button', { name: en.auth.signIn }));

    expect(loginWindow()).toBeInTheDocument();
  });

  it('The window opens after signing out', async () => {
    fakeBackend();
    await renderSession();
    await signInThroughTheWindow();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));
    expect(loginWindow()).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: en.auth.signOut }));

    expect(screen.getByTestId('status')).toHaveTextContent('signedOut');
    expect(loginWindow()).toBeInTheDocument();
    expect(screen.getByLabelText(en.auth.devLoginEmail)).toHaveValue(EMAIL);
    expect(screen.getByLabelText(en.auth.devLoginPassword)).toHaveValue('');
  });

  it('asks again after a reload, with the email remembered and the password empty', async () => {
    fakeBackend();
    const first = await renderSession();
    await signInThroughTheWindow();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));
    first.unmount();
    resetAuthForTests();

    await renderSession();

    expect(loginWindow()).toBeInTheDocument();
    expect(screen.getByLabelText(en.auth.devLoginEmail)).toHaveValue(EMAIL);
    expect(screen.getByLabelText(en.auth.devLoginPassword)).toHaveValue('');
  });

  it('writes nothing but the email to storage', async () => {
    fakeBackend();
    await renderSession();

    await signInThroughTheWindow('  Grzegorz.Galka@PSE.pl ');
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));

    expect({ ...window.localStorage }).toEqual({ [DEV_EMAIL_KEY]: EMAIL });
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain('token');
  });

  it('recovers from a backend restart without opening the window', async () => {
    const backend = fakeBackend();
    await renderSession();
    await signInThroughTheWindow();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));

    // The restarted backend refuses the token issued before it, and accepts the next.
    const original = backend.getMockImplementation()!;
    backend.mockImplementation(async (input, init) => {
      if (!String(input).endsWith('/dashboard')) return original(input, init);
      const sent = (init?.headers as Record<string, string>).Authorization;
      return sent === 'Bearer token-1' ? json(401, { errors: [] }) : json(200, { ok: true });
    });

    await expect(request('/dashboard')).resolves.toEqual({ ok: true });
    expect(loginWindow()).not.toBeInTheDocument();
    const retried = backend.mock.calls.at(-1)![1];
    expect((retried?.headers as Record<string, string>).Authorization).toBe('Bearer token-2');
  });

  it('does not sign back in silently after a sign-out', async () => {
    const backend = fakeBackend();
    await renderSession();
    await signInThroughTheWindow();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));

    await userEvent.click(screen.getByRole('button', { name: en.auth.signOut }));
    backend.mockImplementation(async () => json(401, { errors: [] }));

    await expect(request('/dashboard')).rejects.toThrow();
    expect(backend.mock.calls.some(([url]) => String(url).endsWith('/auth/dev-login'))).toBe(true);
    expect(screen.getByTestId('status')).toHaveTextContent('signedOut');
  });

  it('the first sign-in moves to the new step', async () => {
    const backend = fakeBackend();
    await renderSession();

    await signInThroughTheWindow(NEW_EMAIL, DERIVED);

    expect(await screen.findByLabelText(en.auth.devPasswordNew)).toHaveValue('');
    expect(screen.getByLabelText(en.auth.devLoginEmail)).toHaveValue(NEW_EMAIL);
    expect(screen.getByLabelText(en.auth.devPasswordName)).toHaveValue('Jan');
    expect(screen.getByLabelText(en.auth.devPasswordSurname)).toHaveValue('Kowalski');
    expect(loginWindow()).toBeInTheDocument();
    expect(screen.getByTestId('status')).toHaveTextContent('signedOut');
    expect(devPasswordCalls(backend)).toHaveLength(0);
  });

  it('setting the password signs in', async () => {
    const backend = fakeBackend();
    await renderSession();
    await signInThroughTheWindow(NEW_EMAIL, DERIVED);

    const surname = await screen.findByLabelText(en.auth.devPasswordSurname);
    await userEvent.clear(surname);
    await userEvent.type(surname, 'Kowalska');
    await userEvent.type(screen.getByLabelText(en.auth.devPasswordNew), CHOSEN);
    await userEvent.type(screen.getByLabelText(en.auth.devPasswordRepeat), CHOSEN);
    await userEvent.click(screen.getByRole('button', { name: en.auth.devPasswordSubmit }));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));
    expect(screen.getByTestId('email')).toHaveTextContent(NEW_EMAIL);
    expect(loginWindow()).not.toBeInTheDocument();
    const [, init] = devPasswordCalls(backend)[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      email: NEW_EMAIL,
      current_password: DERIVED,
      new_password: CHOSEN,
      name: 'Jan',
      surname: 'Kowalska',
    });
    expect({ ...window.localStorage }).toEqual({ [DEV_EMAIL_KEY]: NEW_EMAIL });

    // The token it was given is the one sent, and a restart is recovered with
    // the chosen password, never the derived one.
    await request('/dashboard').catch(() => undefined);
    const [, sent] = backend.mock.calls.at(-1)!;
    expect((sent?.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
    const original = backend.getMockImplementation()!;
    backend.mockImplementation(async (input, init) => {
      if (!String(input).endsWith('/dashboard')) return original(input, init);
      const token = (init?.headers as Record<string, string>).Authorization;
      return token === 'Bearer token-1' ? json(401, { errors: [] }) : json(200, { ok: true });
    });
    await expect(request('/dashboard')).resolves.toEqual({ ok: true });
  });

  it('closing the window at the new password step drops it, and the next sign-in asks again', async () => {
    const backend = fakeBackend();
    await renderSession();
    await signInThroughTheWindow(NEW_EMAIL, DERIVED);
    await screen.findByLabelText(en.auth.devPasswordNew);

    await userEvent.click(screen.getByRole('button', { name: en.auth.devLoginClose }));

    expect(loginWindow()).not.toBeInTheDocument();
    expect(screen.getByTestId('status')).toHaveTextContent('signedOut');
    expect(devPasswordCalls(backend)).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: en.auth.signIn }));
    expect(screen.getByLabelText(en.auth.devLoginPassword)).toHaveValue('');
    await signInThroughTheWindow(NEW_EMAIL, DERIVED);
    expect(await screen.findByLabelText(en.auth.devPasswordNew)).toBeInTheDocument();
  });
});
