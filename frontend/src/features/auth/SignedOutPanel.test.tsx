/**
 * Requirement: no page content is shown without a session.
 * See specs/authentication/spec.md and design D6 of add-navigation-context.
 *
 * The session is a stand-in whose status the test moves, rendered through the
 * whole route shell: the gate is there, not in any one page.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoutes } from '../../routes';
import { renderWithLanguage } from '../../test/render';
import { en, type Translations } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import type { Language } from '../../i18n/languages';
import { AuthContext, type AuthState, type SessionStatus } from './AuthProvider';
import {
  board,
  MEETINGS,
  MEMBER,
  serveBoard,
  TEAM_ID,
  TREND,
  jsonResponse,
} from '../board/boardFixture';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  serveBoard(fetchMock, {
    boards: Object.fromEntries(MEETINGS.meetings.map((m) => [m.id, board(m.date)])),
    trend: TREND,
    write: () => jsonResponse({}),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A session the test drives: signing in and out work, and it can be ended. */
function Session({ initial, children }: { initial: SessionStatus; children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>(initial);
  const value = useMemo<AuthState>(
    () => ({
      status,
      email: status === 'signedIn' ? MEMBER : null,
      signIn: async () => setStatus('signedIn'),
      signOut: async () => setStatus('signedOut'),
    }),
    [status],
  );
  return (
    <AuthContext.Provider value={value}>
      {children}
      {/* Stands in for a renewal failing, which the real provider reports this way. */}
      <button type="button" hidden={status !== 'signedIn'} onClick={() => setStatus('ended')}>
        end-session
      </button>
    </AuthContext.Provider>
  );
}

async function renderBoardRoute(initial: SessionStatus, language: Language = 'en') {
  await renderWithLanguage(
    <Session initial={initial}>
      <AppRoutes completeSignIn={async () => true} />
    </Session>,
    language,
    { route: `/teams/${TEAM_ID}`, auth: { email: MEMBER } },
  );
}

const boardHeading = () => screen.queryByRole('heading', { name: 'Board of Platform' });
const panel = (catalogue: Translations = en) =>
  screen.queryByRole('heading', { name: catalogue.auth.signedOutTitle });
const main = () => screen.getByRole('main');

describe('the signed-out panel', () => {
  it('Signing out replaces the page with the panel', async () => {
    await renderBoardRoute('signedIn');
    expect(await screen.findByRole('heading', { name: 'Board of Platform' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: `Account: ${MEMBER}` }));
    const requests = fetchMock.mock.calls.length;

    expect(boardHeading()).not.toBeInTheDocument();
    expect(panel()).toBeInTheDocument();
    expect(main()).toHaveTextContent(en.auth.signedOutBody);
    expect(within(main()).getByRole('button', { name: en.auth.signIn })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/loading/i);
    // Nothing is left mounted to ask for anything.
    expect(fetchMock.mock.calls.length).toBe(requests);
  });

  it('An ended session replaces the page with the panel', async () => {
    await renderBoardRoute('signedIn');
    await screen.findByRole('heading', { name: 'Board of Platform' });

    await userEvent.click(screen.getByRole('button', { name: 'end-session' }));

    expect(boardHeading()).not.toBeInTheDocument();
    expect(panel()).toBeInTheDocument();
    expect(main()).toHaveTextContent(en.auth.sessionEnded);
    expect(within(main()).getByRole('button', { name: en.auth.signIn })).toBeInTheDocument();
  });

  it('Signing in from the panel returns to the page', async () => {
    await renderBoardRoute('signedOut');
    expect(panel()).toBeInTheDocument();
    expect(boardHeading()).not.toBeInTheDocument();
    // While the panel is shown, nothing is requested.
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(within(main()).getByRole('button', { name: en.auth.signIn }));

    expect(await screen.findByRole('heading', { name: 'Board of Platform' })).toBeInTheDocument();
    expect(panel()).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Revenue' })).toBeInTheDocument();
  });

  it('The panel reads in Polish', async () => {
    await renderBoardRoute('signedOut', 'pl');

    expect(panel(pl)).toBeInTheDocument();
    expect(main()).toHaveTextContent(pl.auth.signedOutBody);
    expect(within(main()).getByRole('button', { name: pl.auth.signIn })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
