/**
 * "My teams' problems and tasks": the funnel, the way to each team's lists,
 * and the items assigned to the viewer.
 * See specs/dashboard/spec.md, "The problems and tasks of the viewer's teams",
 * "The tile leads to each team's problems and tasks" and "The items assigned
 * to the viewer".
 */
import { afterEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLanguage } from '../../test/render';
import { AddressProbe } from '../../test/AddressProbe';
import { changeLanguage } from '../../i18n';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import type { AssignedItem } from '../../api/dashboard';
import { ItemsTile } from './ItemsTile';
import { dashboardSummary } from './dashboardFixture';

const summary = dashboardSummary();

afterEach(async () => {
  await changeLanguage('en');
  window.localStorage.clear();
});

async function renderTile(
  { items = summary.assigned_items }: { items?: AssignedItem[] } = {},
  language: 'en' | 'pl' = 'en',
) {
  await renderWithLanguage(
    <>
      <ItemsTile
        funnel={summary.funnel}
        teams={summary.teams}
        items={items}
        email={summary.current_user.email}
      />
      <AddressProbe />
    </>,
    language,
  );
}

const address = () => screen.getByTestId('address');
const assigned = () => screen.getByRole('region', { name: en.itemsTile.assignedHeading });

describe('the funnel', () => {
  it('Each stage shows its figures', async () => {
    await renderTile();
    const stages = screen.getAllByRole('listitem').slice(0, 3);

    expect(stages[0]).toHaveTextContent(en.itemsTile.stage_open);
    expect(stages[1]).toHaveTextContent(en.itemsTile.stage_in_progress);
    expect(stages[2]).toHaveTextContent(en.itemsTile.stage_archived);
    // Totals are summed from the split, not sent.
    expect(stages[0]).toHaveTextContent('18');
    expect(stages[1]).toHaveTextContent('11');
    expect(stages[2]).toHaveTextContent('64');
    expect(stages[0]).toHaveTextContent('11 problems · 7 tasks');
    expect(screen.getByText('Across my teams: 3')).toBeInTheDocument();
    expect(screen.getByText(en.itemsTile.footRight)).toBeInTheDocument();
  });

  it('states the stages and the scope in Polish when Polish is active', async () => {
    await renderTile({}, 'pl');

    expect(screen.getByText(pl.itemsTile.stage_archived)).toBeInTheDocument();
    expect(screen.getByText(pl.itemsTile.scope.replace('{{count}}', '3'))).toBeInTheDocument();
  });
});

describe('the lists of each team', () => {
  it('Links lead to the board’s lists', async () => {
    await renderTile();
    const lists = screen.getByRole('region', { name: en.itemsTile.teamLinksHeading });
    const payments = within(lists).getByText('Payments').closest('li')!;

    await userEvent.click(within(payments).getByRole('link', { name: en.itemsTile.problemsLink }));
    expect(address()).toHaveTextContent(/^\/teams\/payments#problems$/);

    await userEvent.click(within(payments).getByRole('link', { name: en.itemsTile.tasksLink }));
    expect(address()).toHaveTextContent(/^\/teams\/payments#tasks$/);

    await userEvent.click(within(payments).getByRole('link', { name: en.itemsTile.archiveLink }));
    expect(address()).toHaveTextContent(/^\/teams\/payments\?view=archived$/);
  });
});

describe('the assigned items', () => {
  it('Assigned items are shown in detail', async () => {
    await renderTile();
    const [task, problem, undated] = within(assigned()).getAllByRole('listitem');

    expect(task).toHaveTextContent(en.items.kind_task);
    expect(task).toHaveTextContent('Skrócić czas realizacji poniżej 5 dni');
    expect(task).toHaveTextContent('Payments');
    expect(task).toHaveTextContent(en.pdca.plan);
    expect(task).toHaveTextContent(/Due \d+ Sept?/);
    expect(task).toHaveTextContent('Metric: Lead time');
    expect(task).toHaveTextContent('From problem: Releases wait for approval');

    expect(problem).toHaveTextContent(en.items.kind_problem);
    expect(problem).toHaveTextContent('Deploy pipeline flaky');
    expect(problem).not.toHaveTextContent(/Metric:|From problem:/);

    expect(undated).toHaveTextContent('Runbook missing');
    expect(undated).toHaveTextContent(en.items.noDueDate);

    expect(screen.getByText('Assigned to g.galka@pse.pl')).toBeInTheDocument();
  });

  it('An overdue item is distinguished', async () => {
    await renderTile();
    const [overdue, onTime] = within(assigned()).getAllByRole('listitem');

    // A word, not only a colour.
    expect(within(overdue!).getByText(en.items.overdue)).toBeInTheDocument();
    expect(onTime).not.toHaveTextContent(en.items.overdue);
    expect(within(assigned()).getAllByText(en.items.overdue)).toHaveLength(1);
  });

  it('An assigned item leads to its list', async () => {
    await renderTile();

    await userEvent.click(
      within(assigned()).getByRole('link', { name: 'Skrócić czas realizacji poniżej 5 dni' }),
    );
    expect(address()).toHaveTextContent(/^\/teams\/payments#tasks$/);

    await userEvent.click(within(assigned()).getByRole('link', { name: 'Deploy pipeline flaky' }));
    expect(address()).toHaveTextContent(/^\/teams\/platform-core#problems$/);
  });

  it('shows a summary as it was typed, whatever the active language', async () => {
    await renderTile({}, 'pl');
    const list = screen.getByRole('region', { name: pl.itemsTile.assignedHeading });

    expect(within(list).getByText('Deploy pipeline flaky')).toBeInTheDocument();
    expect(within(list).getByText(pl.pdca.do)).toBeInTheDocument();
  });

  it('offers no control to move a stage from the dashboard', async () => {
    await renderTile();

    expect(within(assigned()).queryByRole('button')).not.toBeInTheDocument();
  });

  it('The viewer has no assigned items', async () => {
    await renderTile({ items: [] }, 'pl');
    const list = screen.getByRole('region', { name: pl.itemsTile.assignedHeading });

    expect(within(list).getByText(pl.itemsTile.empty)).toBeInTheDocument();
    expect(within(list).queryByRole('list')).not.toBeInTheDocument();
  });
});
