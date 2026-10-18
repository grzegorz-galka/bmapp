/**
 * The readiness panel on the board. One test per scenario of "The readiness
 * panel", "The readiness panel has its own address", "Copy the addresses of
 * those who owe data" and "The panel shows pulse names only to those who may
 * read them" in specs/meeting-readiness/spec.md, then design risk 1.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { BoardPage } from './BoardPage';
import { owingAddresses } from './ReadinessPanel';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import type { Language } from '../../i18n/languages';
import type { MissingMetric } from '../../api/metrics';
import {
  board,
  definition,
  jsonResponse,
  LEADER,
  MEETINGS,
  MEMBER,
  MONDAY,
  pulseResults,
  serveBoard,
  TEAM_ID,
  tile,
  TREND,
  type Fixtures,
} from './boardFixture';

const fetchMock = vi.fn();
let fixtures: Fixtures;

const JAN = 'jan@example.com';
const KASIA = 'kasia@example.com';

function missingMetric(id: string, name: string, owner: string | null): MissingMetric {
  return { metric_id: id, name, owner: owner ? { id: `emp-${id}`, email: owner } : null };
}

/** The spec's coming meeting: 3 of 5 recorded, NPS owned by Anna, OTIF by no one. */
function comingBoard(owing = 3) {
  return board('2026-10-14', {
    completeness: {
      recorded: 3,
      total: 5,
      missing: [missingMetric('nps', 'NPS', LEADER), missingMetric('otif', 'OTIF', null)],
      owing,
    },
  });
}

/** 4 of 6 answered; Jan and Kasia have not. */
function comingPulse(overrides: Parameters<typeof pulseResults>[1] = {}) {
  return pulseResults('m-2026-10-14', {
    answered: 4,
    members: 6,
    missing: [
      { employee_id: 'emp-jan', email: JAN },
      { employee_id: 'emp-kasia', email: KASIA },
    ],
    missing_count: 2,
    ...overrides,
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MONDAY);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fixtures = {
    boards: {
      ...Object.fromEntries(MEETINGS.meetings.map((m) => [m.id, board(m.date)])),
      'm-2026-10-14': comingBoard(),
    },
    trend: TREND,
    pulse: { 'm-2026-10-14': comingPulse() },
    write: () => jsonResponse({}),
  };
  serveBoard(fetchMock, fixtures);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function renderBoard(
  query = '',
  auth: { email?: string; isAdmin?: boolean } = { email: MEMBER },
  language: Language = 'en',
) {
  await renderWithLanguage(
    <Routes>
      <Route path="/teams/:teamId" element={<BoardPage />} />
    </Routes>,
    language,
    { route: `/teams/${TEAM_ID}${query}`, auth },
  );
  const catalogue = language === 'en' ? en : pl;
  await screen.findByRole('heading', {
    name: catalogue.board.heading.replace('{{name}}', 'Platform'),
  });
}

/** The panel, once the board has loaded; a `<details>` is a group. */
function findPanel(heading: string = en.readiness.heading) {
  return screen.findByRole('group', { name: heading }, { timeout: 5000 });
}

/** The panel once the pulse results have reached it too. */
async function loadedPanel() {
  const panel = await findPanel();
  await waitFor(() => expect(panel).not.toHaveTextContent(en.readiness.pulseLoading));
  return panel;
}

function section(panel: HTMLElement, name: string) {
  return within(panel).getByRole('region', { name });
}

describe('the readiness panel', () => {
  it('The panel lists what is missing', async () => {
    await renderBoard();
    const panel = await loadedPanel();

    expect(panel).toHaveAttribute('open');
    const metrics = within(section(panel, en.readiness.metricsHeading)).getAllByRole('listitem');
    expect(metrics.map((item) => item.textContent)).toEqual([
      `NPS – ${LEADER}`,
      `OTIF – ${en.readiness.noOwner}`,
    ]);
    const members = within(section(panel, en.readiness.pulseHeading)).getAllByRole('listitem');
    expect(members.map((item) => item.textContent)).toEqual([JAN, KASIA]);
    expect(panel).toHaveTextContent('3 people still owe data');
    // Above the tiles, in the metrics view.
    expect(
      panel.compareDocumentPosition(screen.getByRole('heading', { name: 'Revenue' })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('A complete meeting says so', async () => {
    fixtures.boards['m-2026-10-14'] = board('2026-10-14', {
      completeness: { recorded: 5, total: 5, missing: [], owing: 0 },
    });
    fixtures.pulse!['m-2026-10-14'] = comingPulse({
      answered: 6,
      missing: [],
      missing_count: 0,
    });
    await renderBoard();
    const panel = await findPanel();

    expect(await within(panel).findByText(en.readiness.complete)).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: en.readiness.copy })).toBeNull();
  });

  it('A past meeting has no panel', async () => {
    // The 7th still takes values, but it has been held.
    await renderBoard('?meeting=m-2026-10-07');
    await screen.findByRole('heading', { name: 'Revenue' });
    expect(screen.queryByRole('group', { name: en.readiness.heading })).toBeNull();

    // The 21st is to come, but no longer takes values.
    cleanup();
    await renderBoard('?meeting=m-2026-10-21');
    await screen.findByRole('heading', { name: 'Revenue' });
    expect(screen.queryByRole('group', { name: en.readiness.heading })).toBeNull();
  });

  it('The panel stays current', async () => {
    fixtures.boards['m-2026-10-14'] = comingBoard();
    fixtures.boards['m-2026-10-14'].metrics = [
      tile({ metric: definition({ id: 'nps', name: 'NPS' }), value: null }),
    ];
    fixtures.write = () => {
      fixtures.boards['m-2026-10-14'] = board('2026-10-14', {
        completeness: {
          recorded: 4,
          total: 5,
          missing: [missingMetric('otif', 'OTIF', null)],
          owing: 2,
        },
      });
      return jsonResponse({});
    };
    const user = userEvent.setup();
    await renderBoard('?mode=record');
    const panel = await loadedPanel();
    expect(within(panel).getByText(/^NPS/)).toBeInTheDocument();

    const field = await screen.findByRole('textbox', { name: 'Value: NPS' });
    await user.type(field, '42');
    await user.tab();

    await waitFor(() => expect(within(panel).queryByText(/^NPS/)).toBeNull());
    expect(panel).toHaveTextContent('2 people still owe data');
  });

  it('reads in Polish, with Polish plural forms', async () => {
    await renderBoard('', { email: MEMBER }, 'pl');
    const panel = await findPanel(pl.readiness.heading);

    expect(panel).toHaveTextContent('3 osoby muszą jeszcze uzupełnić dane');
    expect(panel).toHaveTextContent(`OTIF – ${pl.readiness.noOwner}`);
  });
});

describe('the readiness panel has its own address', () => {
  let scrolled: Element[];

  beforeEach(() => {
    scrolled = [];
    // jsdom lays nothing out, so it has no scrollIntoView of its own.
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this);
    });
  });

  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it('The panel is opened from its address', async () => {
    await renderBoard('?meeting=m-2026-10-14#readiness');
    const panel = await findPanel();

    expect((screen.getByLabelText(en.board.meetingSelectLabel) as HTMLSelectElement).value).toBe(
      'm-2026-10-14',
    );
    expect(panel).toHaveAttribute('open');
    await waitFor(() => expect(scrolled).toEqual([panel]));
  });

  it('is not scrolled to without the fragment', async () => {
    await renderBoard();
    await findPanel();

    expect(scrolled).toEqual([]);
  });
});

describe('the addresses of those who owe data are copied', () => {
  it('The addresses are copied', async () => {
    // Anna owns the missing NPS, Jan has not answered; Anna owns OTIF too, as a second gap.
    fixtures.boards['m-2026-10-14'] = board('2026-10-14', {
      completeness: {
        recorded: 3,
        total: 5,
        missing: [missingMetric('nps', 'NPS', LEADER), missingMetric('otif', 'OTIF', LEADER)],
        owing: 2,
      },
    });
    fixtures.pulse!['m-2026-10-14'] = comingPulse({
      missing: [{ employee_id: 'emp-jan', email: JAN }],
      missing_count: 1,
    });
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await renderBoard();
    const panel = await loadedPanel();

    await user.click(within(panel).getByRole('button', { name: en.readiness.copy }));

    expect(writeText).toHaveBeenCalledWith(`${LEADER}; ${JAN}`);
    const status = within(panel).getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    await waitFor(() => expect(status).toHaveTextContent('2 addresses copied'));
  });

  it('Copying fails', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.reject(new DOMException('Denied', 'NotAllowedError')));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await renderBoard();
    const panel = await loadedPanel();

    await user.click(within(panel).getByRole('button', { name: en.readiness.copy }));

    expect(await within(panel).findByRole('status')).toHaveTextContent(en.readiness.copyFailed);
    const field = within(panel).getByRole<HTMLTextAreaElement>('textbox', {
      name: en.readiness.addressesLabel,
    });
    const list = `${LEADER}; ${JAN}; ${KASIA}`;
    expect(field).toHaveValue(list);
    expect(field).toHaveAttribute('readonly');
    expect(field).toHaveFocus();
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, list.length]);
  });

  it('A viewer from outside the team', async () => {
    fixtures.boards['m-2026-10-14'] = board('2026-10-14', {
      completeness: {
        recorded: 4,
        total: 5,
        missing: [missingMetric('nps', 'NPS', LEADER)],
        owing: 3,
      },
    });
    fixtures.pulse!['m-2026-10-14'] = comingPulse({
      answers: null,
      missing: null,
      own: null,
      missing_count: 2,
    });
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await renderBoard('', { email: 'stranger@example.com' });
    const panel = await loadedPanel();

    const pulse = section(panel, en.readiness.pulseHeading);
    expect(pulse).toHaveTextContent('2 members have not answered');
    expect(within(pulse).queryByRole('listitem')).toBeNull();
    expect(panel).toHaveTextContent('3 people still owe data');
    expect(panel).toHaveTextContent(en.readiness.ownersOnly);

    await user.click(within(panel).getByRole('button', { name: en.readiness.copy }));
    expect(writeText).toHaveBeenCalledWith(LEADER);
    await waitFor(() =>
      expect(within(panel).getByRole('status')).toHaveTextContent('1 address copied'),
    );
  });

  it('The merged names match the reported count', () => {
    // Anna owns two missing metrics and has not answered either; Jan has not answered.
    const twoGaps = board('2026-10-14', {
      completeness: {
        recorded: 1,
        total: 3,
        missing: [
          missingMetric('nps', 'NPS', 'Anna@Example.com'),
          missingMetric('otif', 'OTIF', LEADER),
          missingMetric('lead', 'Lead time', null),
        ],
        owing: 2,
      },
    });
    const pulse = comingPulse({
      missing: [
        { employee_id: 'emp-anna', email: LEADER },
        { employee_id: 'emp-jan', email: JAN },
      ],
    });

    const merged = owingAddresses(twoGaps, pulse);

    expect(merged).toEqual([LEADER, JAN]);
    expect(merged).toHaveLength(twoGaps.completeness.owing);
  });
});
