/**
 * The back link a team's page carries: to where the page was opened from, or
 * to the page's default. See "A team's pages lead back to where they were
 * opened from" in specs/dashboard/spec.md, and design D1, D2 and D4 of
 * add-navigation-context.
 */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { BackLink } from './BackLink';
import { AddressProbe } from '../test/AddressProbe';
import { renderWithLanguage } from '../test/render';
import { en } from '../i18n/en';
import { pl } from '../i18n/pl';

const fallback = { to: '/teams', label: en.board.back };

function renderAt(state: unknown, language: 'en' | 'pl' = 'en') {
  return renderWithLanguage(
    <>
      <Routes>
        <Route path="/teams/:teamId" element={<BackLink fallback={fallback} />} />
        <Route path="*" element={null} />
      </Routes>
      <AddressProbe />
    </>,
    language,
    { route: { pathname: '/teams/team-1', state } },
  );
}

describe('BackLink', () => {
  it('leads to a known origin, named after it, and passes its own state on', async () => {
    const boardState = { from: { screen: 'myTeams', path: '/my-teams' } };
    await renderAt({
      from: { screen: 'board', path: '/teams/team-1?view=pulse', state: boardState },
    });

    const link = screen.getByRole('link', { name: en.back.board });
    expect(link).toHaveAttribute('href', '/teams/team-1?view=pulse');

    await userEvent.click(link);

    expect(screen.getByTestId('address')).toHaveTextContent('/teams/team-1?view=pulse');
    expect(JSON.parse(screen.getByTestId('location-state').textContent!)).toEqual(boardState);
    expect(screen.getByRole('link', { name: en.back.myTeams })).toHaveAttribute(
      'href',
      '/my-teams',
    );
  });

  it.each(Object.keys(en.back) as (keyof typeof en.back)[])(
    'names the %s screen in the active language',
    async (screenName) => {
      await renderAt({ from: { screen: screenName, path: '/somewhere' } }, 'pl');

      expect(screen.getByRole('link', { name: pl.back[screenName] })).toHaveAttribute(
        'href',
        '/somewhere',
      );
    },
  );

  it.each([
    ['no state', undefined],
    ['no origin', { something: 'else' }],
    ['an unknown screen', { from: { screen: 'nowhere', path: '/nowhere' } }],
    ['an origin without a path', { from: { screen: 'dashboard' } }],
  ])('falls back to the default with %s', async (_, state) => {
    await renderAt(state);

    expect(screen.getByRole('link', { name: en.board.back })).toHaveAttribute('href', '/teams');
  });
});
