import { expect, test } from '@playwright/test';
import { en } from '../src/i18n/en';
import { organizationToday } from '../src/features/board/organizationDate';
import { ADMIN_EMAIL, signInAs } from './auth';
import { addDays, apiAs, uniqueSuffix } from './api';

/*
 * A project a team follows, from its list to the board: the leader adds the
 * project and a metric to it, which arrives hidden, and shows it on the board;
 * a member records its value at the coming meeting and the tile names the
 * project; making the project inactive retires the metric and its tile goes.
 * The stack keeps its data between runs, so the team, the people and the
 * project's code - unique company-wide - are unique to the run.
 */

test('a leader follows a project on the board until it is made inactive', async ({
  page,
  request,
}) => {
  const suffix = uniqueSuffix();
  const leader = `e2e.lead.${suffix}@example.com`;
  const member = `e2e.member.${suffix}@example.com`;
  const manager = `e2e.manager.${suffix}@example.com`;
  const code = `PRJ-${suffix}`;
  const label = `${code} · Scope change`;
  const today = organizationToday();

  const admin = await apiAs(request, ADMIN_EMAIL);
  const team = await admin.registerTeam(`E2E Projects ${suffix}`, leader);
  await admin.addMember(team.id, member);
  await admin.openMeeting(team.id, addDays(today, 3));

  // The leader adds the project, managed by someone from outside the team.
  await signInAs(page, leader);
  await page.goto(`/teams/${team.id}`);
  await page.getByRole('link', { name: en.projectsAndProducts.list.heading }).click();
  await expect(page).toHaveURL(new RegExp(`/teams/${team.id}/projects-and-products$`));
  await page.getByRole('button', { name: en.projectsAndProducts.list.addProject }).click();
  const add = page.getByRole('dialog', { name: en.projectsAndProducts.list.addProject });
  await add.getByLabel(en.projectsAndProducts.common.code).fill(code);
  await add.getByLabel(en.projectsAndProducts.common.name, { exact: true }).fill('Billing rewrite');
  await add.getByLabel(en.projectsAndProducts.list.managerEmail).fill(manager);
  await add.getByLabel(en.projectsAndProducts.common.startDate).fill(addDays(today, -30));
  await add.getByLabel(en.projectsAndProducts.common.endDate).fill(addDays(today, 60));
  await add.getByRole('button', { name: en.projectsAndProducts.list.save }).click();
  await expect(add).toBeHidden();
  const projects = page.getByRole('list', { name: en.projectsAndProducts.list.projectsLabel });
  await expect(projects).toContainText('Billing rewrite');
  await expect(projects).toContainText('Project manager: E2e Manager');

  // On the project's page, a metric is added; it arrives not on the board.
  await projects.getByRole('link', { name: `${code} · Billing rewrite` }).click();
  await expect(
    page.getByRole('heading', { name: `${code} · Billing rewrite`, level: 1 }),
  ).toBeVisible();
  await page.getByRole('button', { name: en.projectsAndProducts.detail.addMetric }).click();
  const create = page.getByRole('dialog', { name: en.metrics.create });
  await create.getByLabel(en.metrics.nameLabel).fill('Scope change');
  await create.getByLabel(en.metrics.unitLabel).fill('%');
  await create.getByLabel(en.metrics.decimalsLabel).fill('1');
  await create.getByLabel(en.metrics.directionLabel).selectOption('lower_is_better');
  await create.getByRole('button', { name: en.metrics.add, exact: true }).click();
  await expect(create).toBeHidden();
  const row = page.getByRole('listitem').filter({ hasText: 'Scope change' });
  // The project's own page names the metric bare.
  await expect(row).not.toContainText(code);
  await expect(row.getByText(en.projectsAndProducts.common.notOnBoard)).toBeVisible();

  // Shown on the board, from the switch on the project's page.
  const hidden = page.getByRole('switch', { name: 'Hidden on board: Scope change' });
  await expect(hidden).toBeChecked();
  await hidden.click();
  await expect(hidden).not.toBeChecked();
  await expect(row.getByText(en.projectsAndProducts.common.notOnBoard)).toBeHidden();

  // A member records its value at the coming meeting.
  await signInAs(page, member);
  await page.goto(`/teams/${team.id}`);
  await page.getByRole('button', { name: en.board.record }).click();
  await page.getByRole('textbox', { name: `Value: ${label}` }).fill('4.5');
  await page.getByRole('textbox', { name: `Comment: ${label}` }).click();
  await expect(page.getByText(en.recording.saved).first()).toBeVisible();

  // The tile names the project before the metric.
  await page.getByRole('button', { name: en.board.showTiles }).click();
  const tile = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: label }) });
  await expect(tile).toContainText('4.5 %');

  // Making the project inactive retires its metric: the tile goes.
  await signInAs(page, leader);
  await page.goto(`/teams/${team.id}/projects-and-products`);
  await page.getByRole('button', { name: `Make inactive: ${code} · Billing rewrite` }).click();
  await expect(projects).toContainText(en.projectsAndProducts.common.inactive);
  await page.goto(`/teams/${team.id}`);
  // Nothing is owed or counted for it any more, though its value stays recorded.
  await expect(page.getByRole('button', { name: 'Metrics 0/0' })).toBeVisible();
  await expect(page.getByRole('heading', { name: label })).toHaveCount(0);
});
