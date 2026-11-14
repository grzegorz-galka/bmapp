/**
 * The projects and products page. One test per scenario of "The team's
 * projects and products page" in specs/projects-and-products/spec.md, and the
 * page's half of "An active project past its end date is flagged".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { ProjectsAndProductsPage } from './ProjectsAndProductsPage';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import type { Language } from '../../i18n/languages';
import type { Member, TeamDetail } from '../../api/teams';
import type { Project } from '../../api/projects';
import type { Product } from '../../api/products';

const TEAM_ID = 'team-1';
const LEADER = 'anna@example.com';
const MEMBER = 'bartek@example.com';
const list = en.projectsAndProducts.list;
const common = en.projectsAndProducts.common;

function member(email: string, isLeader = false): Member {
  const local = email.split('@')[0] ?? email;
  return {
    employee_id: `emp-${local}`,
    email,
    display_name: local.charAt(0).toUpperCase() + local.slice(1),
    is_leader: isLeader,
    is_deputy: false,
  };
}

const TEAM: TeamDetail = {
  id: TEAM_ID,
  name: 'Platform',
  board: { id: 'board-1', name: 'Platform', schedule: null },
  members: [member(LEADER, true), member(MEMBER)],
};

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    team_id: TEAM_ID,
    code: 'PRJ-042',
    name: 'Billing rewrite',
    manager: { id: 'emp-ewa', email: 'ewa@example.com', display_name: 'Ewa Nowak' },
    start_date: '2026-09-01',
    end_date: '2027-03-31',
    active: true,
    past_end: false,
    ...overrides,
  };
}

const PRODUCT: Product = {
  id: 'product-1',
  team_id: TEAM_ID,
  name: 'Customer portal',
  owner: { id: 'emp-jan', email: 'jan@example.com', display_name: 'Jan Kowalski' },
  jira_url: 'https://jira.example.com/secure/RapidBoard.jspa?rapidView=17',
  active: true,
};

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function errorResponse(status: number, field: string | null, code: string) {
  return jsonResponse({ errors: [{ field, code, message: 'English for a developer.' }] }, status);
}

/**
 * Answers the page's reads from `projects` and `products`, which a test may
 * change as the server would, and each write with what the test queued.
 */
function serve(
  state: { projects: Project[]; products: Product[] },
  writes: Partial<Record<string, () => Response>> = {},
) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (method !== 'GET') return Promise.resolve(writes[method]?.());
    if (url.endsWith('/projects')) return Promise.resolve(jsonResponse(state.projects));
    if (url.endsWith('/products')) return Promise.resolve(jsonResponse(state.products));
    return Promise.resolve(jsonResponse(TEAM));
  });
}

function requests(method: string): { url: string; body: unknown }[] {
  return (fetchMock.mock.calls as [string, RequestInit | undefined][])
    .filter(([, init]) => (init?.method ?? 'GET') === method)
    .map(([url, init]) => ({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined }));
}

async function renderPage(email: string, language: Language = 'en') {
  await renderWithLanguage(
    <Routes>
      <Route path="/teams/:teamId/projects-and-products" element={<ProjectsAndProductsPage />} />
    </Routes>,
    language,
    { route: `/teams/${TEAM_ID}/projects-and-products`, auth: { email } },
  );
}

function projectRow(code: string, label: string = list.projectsLabel) {
  const row = within(screen.getByRole('list', { name: label }))
    .getAllByRole('listitem')
    .find((item) => item.textContent?.includes(code));
  if (!row) throw new Error(`no row for ${code}`);
  return row;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("The team's projects and products page", () => {
  it('a leader adds a project', async () => {
    const user = userEvent.setup();
    const state = { projects: [] as Project[], products: [PRODUCT] };
    const added = project();
    serve(state, {
      POST: () => {
        state.projects = [added];
        return jsonResponse(added, 201);
      },
    });
    await renderPage(LEADER);
    await screen.findByRole('heading', { name: 'Projects and products of Platform' });
    expect(screen.getByText(list.noProjects)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: list.addProject }));
    const dialog = screen.getByRole('dialog', { name: list.addProject });
    await user.type(within(dialog).getByLabelText(common.code), 'PRJ-042');
    await user.type(within(dialog).getByLabelText(common.name), 'Billing rewrite');
    await user.type(within(dialog).getByLabelText(list.managerEmail), 'ewa@example.com');
    await user.type(within(dialog).getByLabelText(common.startDate), '2026-09-01');
    await user.type(within(dialog).getByLabelText(common.endDate), '2027-03-31');
    await user.click(within(dialog).getByRole('button', { name: list.save }));

    const row = await screen.findByRole('link', { name: 'PRJ-042 · Billing rewrite' });
    expect(row).toHaveAttribute('href', `/teams/${TEAM_ID}/projects/project-1`);
    const item = projectRow('PRJ-042');
    expect(item).toHaveTextContent('Project manager: Ewa Nowak');
    expect(item).toHaveTextContent('1 Sept 2026');
    expect(item).toHaveTextContent('31 Mar 2027');
    expect(item).toHaveTextContent(common.active);
    expect(item).not.toHaveTextContent(common.pastEnd);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(requests('POST')).toEqual([
      {
        url: `/api/teams/${TEAM_ID}/projects`,
        body: {
          code: 'PRJ-042',
          name: 'Billing rewrite',
          manager_email: 'ewa@example.com',
          start_date: '2026-09-01',
          end_date: '2027-03-31',
        },
      },
    ]);
  });

  it('a member sees no controls', async () => {
    serve({ projects: [project()], products: [PRODUCT] });
    await renderPage(MEMBER);
    await screen.findByRole('link', { name: 'PRJ-042 · Billing rewrite' });

    expect(screen.getByRole('link', { name: 'Customer portal' })).toHaveAttribute(
      'href',
      `/teams/${TEAM_ID}/products/product-1`,
    );
    expect(screen.getByText('Product owner: Jan Kowalski')).toBeInTheDocument();
    // No add, change, status or delete control anywhere on the page.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('a refused deletion is explained', async () => {
    const user = userEvent.setup();
    serve(
      { projects: [project()], products: [] },
      { DELETE: () => errorResponse(409, null, 'project.has_values') },
    );
    await renderPage(LEADER);
    await screen.findByRole('link', { name: 'PRJ-042 · Billing rewrite' });

    await user.click(screen.getByRole('button', { name: 'Delete: PRJ-042 · Billing rewrite' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: list.delete }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      en.errors['project.has_values'],
    );
    expect(document.body.textContent).not.toContain('English for a developer.');
    await user.click(within(dialog).getByRole('button', { name: list.cancel }));
    expect(screen.getByRole('link', { name: 'PRJ-042 · Billing rewrite' })).toBeInTheDocument();
    expect(requests('DELETE')).toEqual([
      { url: `/api/teams/${TEAM_ID}/projects/project-1`, body: undefined },
    ]);
  });

  it('an active project past its end is marked', async () => {
    serve({
      projects: [
        project({ end_date: '2026-10-31', past_end: true }),
        project({
          id: 'project-2',
          code: 'PRJ-050',
          name: 'Old billing',
          end_date: '2026-10-31',
          active: false,
          past_end: false,
        }),
      ],
      products: [],
    });
    await renderPage(MEMBER, 'pl');
    await screen.findByRole('link', { name: 'PRJ-042 · Billing rewrite' });

    expect(projectRow('PRJ-042', pl.projectsAndProducts.list.projectsLabel)).toHaveTextContent(
      pl.projectsAndProducts.common.pastEnd,
    );
    expect(projectRow('PRJ-042', pl.projectsAndProducts.list.projectsLabel)).toHaveTextContent(
      pl.projectsAndProducts.common.active,
    );
    // Inactive, and so never flagged.
    expect(projectRow('PRJ-050', pl.projectsAndProducts.list.projectsLabel)).toHaveTextContent(
      pl.projectsAndProducts.common.inactive,
    );
    expect(projectRow('PRJ-050', pl.projectsAndProducts.list.projectsLabel)).not.toHaveTextContent(
      pl.projectsAndProducts.common.pastEnd,
    );
  });
});
