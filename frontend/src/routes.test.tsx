/**
 * The route table and the shell every page renders inside.
 * See "The application opens at the hub" in specs/hub/spec.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { renderWithLanguage } from './test/render';
import { en } from './i18n/en';
import { hubSummary } from './features/hub/hubFixture';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => (String(url).includes('/hub') ? hubSummary() : []),
    } as Response),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const nav = () => screen.getByRole('navigation', { name: en.nav.label });

describe('the route table', () => {
  it('shows the hub at the root address', async () => {
    await renderWithLanguage(<App />, 'en', { route: '/' });

    expect(await screen.findByRole('heading', { name: en.hub.heroTitle })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: en.teams.heading })).not.toBeInTheDocument();
  });

  it('shows the team page at its own address', async () => {
    await renderWithLanguage(<App />, 'en', { route: '/teams' });

    expect(await screen.findByRole('heading', { name: en.teams.heading })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: en.hub.heroTitle })).not.toBeInTheDocument();
  });

  it('falls back to the hub for an address it does not recognise', async () => {
    await renderWithLanguage(<App />, 'en', { route: '/nothing-here' });

    expect(await screen.findByRole('heading', { name: en.hub.heroTitle })).toBeInTheDocument();
  });

  it('navigates to the team page without reloading', async () => {
    await renderWithLanguage(<App />, 'en', { route: '/' });
    await screen.findByRole('heading', { name: en.hub.heroTitle });

    await userEvent.click(within(nav()).getByRole('link', { name: en.nav.teams }));

    expect(await screen.findByRole('heading', { name: en.teams.heading })).toBeInTheDocument();
  });

  it('navigates back to the hub', async () => {
    await renderWithLanguage(<App />, 'en', { route: '/teams' });
    await screen.findByRole('heading', { name: en.teams.heading });

    await userEvent.click(within(nav()).getByRole('link', { name: en.nav.hub }));

    expect(await screen.findByRole('heading', { name: en.hub.heroTitle })).toBeInTheDocument();
  });
});

describe('the header', () => {
  it('is on the hub and on the team page alike', async () => {
    await renderWithLanguage(<App />, 'en', { route: '/' });
    expect(nav()).toBeInTheDocument();
    expect(screen.getByLabelText(en.language.label)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.theme.switchToLight })).toBeInTheDocument();

    await userEvent.click(within(nav()).getByRole('link', { name: en.nav.teams }));

    expect(nav()).toBeInTheDocument();
    expect(screen.getByLabelText(en.language.label)).toBeInTheDocument();
  });

  it('marks the destination currently being shown', async () => {
    await renderWithLanguage(<App />, 'en', { route: '/teams' });

    expect(within(nav()).getByRole('link', { name: en.nav.teams })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav()).getByRole('link', { name: en.nav.hub })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('shows the identity from the fetched summary, with no session control', async () => {
    await renderWithLanguage(<App />, 'en', { route: '/' });

    expect(await screen.findByText('g.galka@pse.pl')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });
});

describe('the archive destination', () => {
  it('is named but exposed as unavailable', async () => {
    await renderWithLanguage(<App />, 'en', { route: '/' });

    const archive = within(nav()).getByText(en.nav.archive, { exact: false });
    expect(archive).toHaveAttribute('aria-disabled', 'true');
    expect(archive).toHaveTextContent(en.nav.notYetAvailable);
  });

  it('changes neither the page nor the address when activated', async () => {
    await renderWithLanguage(<App />, 'en', { route: '/' });
    await screen.findByRole('heading', { name: en.hub.heroTitle });

    await userEvent.click(within(nav()).getByText(en.nav.archive, { exact: false }));

    expect(screen.getByRole('heading', { name: en.hub.heroTitle })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('is not a followable link', async () => {
    await renderWithLanguage(<App />, 'en', { route: '/' });

    const archive = within(nav()).getByText(en.nav.archive, { exact: false });
    expect(archive).not.toHaveAttribute('href');
  });
});
