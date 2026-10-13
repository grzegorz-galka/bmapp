/** "My pulse check" in specs/dashboard/spec.md. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import { pulseAnswer, pulseResults } from '../board/boardFixture';
import { MyPulsePage } from './MyPulsePage';
import { NOW, serve } from './personalFixture';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const team = (name: string) => screen.getByRole('region', { name });

describe('My pulse check', () => {
  it('An unanswered pulse check is offered', async () => {
    serve(fetchMock, {
      pulse: {
        'platform-core-2026-10-14': pulseResults('platform-core-2026-10-14', {
          editable: true,
          own: null,
        }),
      },
    });
    await renderWithLanguage(<MyPulsePage />, 'en');
    await screen.findByRole('region', { name: 'Platform Core' });

    const platform = within(team('Platform Core'));
    expect(platform.getByText(en.meetingsTile.pulseNotAnswered)).toBeInTheDocument();
    expect(
      platform.getByRole('link', { name: /^Answer the pulse check: Platform Core/ }),
    ).toHaveAttribute(
      'href',
      '/teams/platform-core?meeting=platform-core-2026-10-14&view=pulse&mode=answer',
    );
    // Only the meeting that takes answers is listed; the one held on the 7th does not here.
    expect(platform.getAllByRole('listitem')).toHaveLength(1);
    expect(
      platform.getByRole('link', { name: 'Pulse check results of Platform Core' }),
    ).toHaveAttribute('href', '/teams/platform-core?view=pulse');
  });

  it('An answered pulse check can be changed', async () => {
    serve(fetchMock, {
      pulse: {
        'payments-2026-10-16': pulseResults('payments-2026-10-16', {
          editable: true,
          own: pulseAnswer('jan.kowalski@pse.pl', 4),
        }),
      },
    });
    await renderWithLanguage(<MyPulsePage />, 'en');
    await screen.findByRole('region', { name: 'Payments' });

    const payments = within(team('Payments'));
    expect(payments.getByText(en.meetingsTile.pulseAnswered)).toBeInTheDocument();
    expect(payments.getByRole('link', { name: /^Change the answer: Payments/ })).toHaveTextContent(
      en.personal.changeAnswer,
    );
  });

  it('says so for a team with no meeting taking answers', async () => {
    serve(fetchMock);
    await renderWithLanguage(<MyPulsePage />, 'en');
    await screen.findByRole('region', { name: 'Infrastructure' });

    expect(within(team('Infrastructure')).getByText(en.personal.pulseNoneOpen)).toBeInTheDocument();
    expect(within(team('Platform Core')).getByText(en.personal.pulseNoneOpen)).toBeInTheDocument();
  });
});
