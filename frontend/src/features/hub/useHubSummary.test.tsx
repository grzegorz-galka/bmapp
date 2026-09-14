/** The hub query: loading, loaded, and failed. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithLanguage } from '../../test/render';
import { useHubSummary } from './useHubSummary';

afterEach(() => {
  vi.restoreAllMocks();
});

function Probe() {
  const summary = useHubSummary();
  if (summary.isPending) return <p>pending</p>;
  if (summary.isError) return <p>failed</p>;
  return <p>{summary.data?.current_user.email}</p>;
}

describe('useHubSummary', () => {
  it('reports that it is loading before the summary arrives', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

    await renderWithLanguage(<Probe />, 'en');

    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('hands back the summary once it arrives', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ current_user: { email: 'g.galka@pse.pl' } }), { status: 200 }),
    );

    await renderWithLanguage(<Probe />, 'en');

    expect(await screen.findByText('g.galka@pse.pl')).toBeInTheDocument();
  });

  it('reports a failure when the request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));

    await renderWithLanguage(<Probe />, 'en');

    expect(await screen.findByText('failed')).toBeInTheDocument();
  });
});
