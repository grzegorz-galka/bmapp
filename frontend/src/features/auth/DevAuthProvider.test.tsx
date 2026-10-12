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
const PASSWORD = 'ggpp';

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

/** A backend whose dev-login accepts only EMAIL with PASSWORD, issuing `token-N`. */
function fakeBackend() {
  let issued = 0;
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/auth/dev-login')) {
      const { email, password } = JSON.parse(String(init?.body)) as Record<string, string>;
      if (password !== PASSWORD) {
        return json(401, {
          errors: [{ field: 'password', code: 'auth.password_incorrect', message: 'x' }],
        });
      }
      if ((email ?? '').trim().toLowerCase() !== EMAIL) {
        return json(401, {
          errors: [{ field: 'email', code: 'auth.employee_unknown', message: 'x' }],
        });
      }
      issued += 1;
      return json(200, { access_token: `token-${issued}`, token_type: 'Bearer' });
    }
    return json(404, { errors: [] });
  });
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
});
