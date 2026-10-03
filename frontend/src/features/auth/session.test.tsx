/**
 * Requirements: a person signs in, signs out, and a session is renewed
 * without interrupting them.
 *
 * The user manager is substituted: these tests are about what the provider
 * does with what the library reports, not about the library.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { User, UserManager } from 'oidc-client-ts';
import i18n from '../../i18n';
import { en } from '../../i18n/en';
import { AuthProvider, useAuth } from './AuthProvider';
import { resetAuthForTests } from '../../api/client';

afterEach(() => {
  resetAuthForTests();
  vi.restoreAllMocks();
});

type Handler = (user: User) => void;

function fakeManager(overrides: Partial<Record<string, unknown>> = {}) {
  const handlers: { loaded: Handler[]; renewError: (() => void)[]; unloaded: (() => void)[] } = {
    loaded: [],
    renewError: [],
    unloaded: [],
  };
  const manager = {
    getUser: vi.fn(async () => null),
    signinSilent: vi.fn(async () => null),
    signinRedirect: vi.fn(async () => undefined),
    signoutRedirect: vi.fn(async () => undefined),
    events: {
      addUserLoaded: (h: Handler) => handlers.loaded.push(h),
      removeUserLoaded: () => {},
      addSilentRenewError: (h: () => void) => handlers.renewError.push(h),
      removeSilentRenewError: () => {},
      addUserUnloaded: (h: () => void) => handlers.unloaded.push(h),
      removeUserUnloaded: () => {},
    },
    ...overrides,
  };
  return { manager: manager as unknown as UserManager, handlers };
}

function signedInUser(email = 'jan.kowalski@pse.pl'): User {
  return { access_token: 'a-token', profile: { email } } as unknown as User;
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

async function renderProbe(manager: UserManager) {
  await i18n.changeLanguage('en');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider userManager={manager}>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('restoring a session', () => {
  it('signs the person back in from the broker session after a reload', async () => {
    const { manager } = fakeManager({ signinSilent: vi.fn(async () => signedInUser()) });

    await renderProbe(manager);

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));
    expect(screen.getByTestId('email')).toHaveTextContent('jan.kowalski@pse.pl');
  });

  it('leaves the person signed out when the broker session has gone', async () => {
    const { manager } = fakeManager({
      signinSilent: vi.fn(async () => {
        throw new Error('login_required');
      }),
    });

    await renderProbe(manager);

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
    expect(screen.getByTestId('email')).toHaveTextContent('(nobody)');
  });

  it('lower-cases the email so it matches the recorded employee', async () => {
    const { manager } = fakeManager({
      signinSilent: vi.fn(async () => signedInUser('Jan.Kowalski@PSE.pl')),
    });

    await renderProbe(manager);

    await waitFor(() =>
      expect(screen.getByTestId('email')).toHaveTextContent('jan.kowalski@pse.pl'),
    );
  });
});

describe('signing in and out', () => {
  it('sends the person to the broker to sign in', async () => {
    const { manager } = fakeManager();
    await renderProbe(manager);

    await userEvent.click(screen.getByRole('button', { name: en.auth.signIn }));

    expect(manager.signinRedirect).toHaveBeenCalled();
  });

  it('discards the tokens and ends the session at the broker', async () => {
    const { manager } = fakeManager({ signinSilent: vi.fn(async () => signedInUser()) });
    await renderProbe(manager);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));

    await userEvent.click(screen.getByRole('button', { name: en.auth.signOut }));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
    expect(screen.getByTestId('email')).toHaveTextContent('(nobody)');
    expect(manager.signoutRedirect).toHaveBeenCalled();
  });
});

describe('renewing a session', () => {
  it('adopts a token renewed in the background without prompting', async () => {
    const { manager, handlers } = fakeManager({
      signinSilent: vi.fn(async () => signedInUser('first@pse.pl')),
    });
    await renderProbe(manager);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));

    handlers.loaded.forEach((handle) => handle(signedInUser('second@pse.pl')));

    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('second@pse.pl'));
    expect(manager.signinRedirect).not.toHaveBeenCalled();
  });

  it('says the session ended when renewal fails, rather than retrying forever', async () => {
    const { manager, handlers } = fakeManager({
      signinSilent: vi.fn(async () => signedInUser()),
    });
    await renderProbe(manager);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));

    handlers.renewError.forEach((handle) => handle());

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ended'));
    expect(manager.signinRedirect).not.toHaveBeenCalled();
  });
});

describe('what signing out leaves behind', () => {
  it('leaves nothing fetched for the person who has gone', async () => {
    const { manager } = fakeManager({ signinSilent: vi.fn(async () => signedInUser()) });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['hub'], { current_user: { email: 'jan.kowalski@pse.pl' } });
    await i18n.changeLanguage('en');

    render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider userManager={manager}>
            <Probe />
          </AuthProvider>
        </QueryClientProvider>
      </I18nextProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));

    await userEvent.click(screen.getByRole('button', { name: en.auth.signOut }));

    // Otherwise the next person to sign in on this browser would see the
    // previous one's board before their own arrived.
    await waitFor(() => expect(queryClient.getQueryData(['hub'])).toBeUndefined());
  });
});
