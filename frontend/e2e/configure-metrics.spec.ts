import { expect, test, type Page } from '@playwright/test';
import { en } from '../src/i18n/en';
import { ADMIN_EMAIL, signInAs } from './auth';
import { organizationToday } from '../src/features/board/organizationDate';
import { addDays, apiAs, uniqueSuffix } from './api';

/*
 * Configuring a board: its leader adds three metrics, one per direction, and
 * gives each a threshold. The stack keeps its data between runs, so the team
 * and the leader are unique to the run.
 */

async function addMetric(page: Page, name: string, unit: string, direction: string) {
  await page.getByRole('button', { name: en.metrics.create }).click();
  const dialog = page.getByRole('dialog', { name: en.metrics.create });
  await dialog.getByLabel(en.metrics.nameLabel).fill(name);
  await dialog.getByLabel(en.metrics.unitLabel).fill(unit);
  await dialog.getByLabel(en.metrics.decimalsLabel).fill('1');
  await dialog.getByLabel(en.metrics.directionLabel).selectOption(direction);
  await dialog.getByRole('button', { name: en.metrics.add, exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible();
}

/**
 * Records a version: its target value, then the tolerances in per cent - or,
 * for a target value of 0, the boundaries - each field by its label.
 */
async function setThreshold(
  page: Page,
  name: string,
  targetValue: string,
  fields: [string, string][],
) {
  await page.getByRole('button', { name: `Change threshold: ${name}` }).click();
  const dialog = page.getByRole('dialog', { name: `New threshold for ${name}` });
  await dialog.getByLabel(en.metrics.effectiveFromLabel).fill('2026-01-01');
  await dialog.getByLabel(en.metrics.targetValueLabel, { exact: true }).fill(targetValue);
  for (const [label, value] of fields) {
    await dialog.getByLabel(label, { exact: true }).fill(value);
  }
  await dialog.getByLabel(en.metrics.reasonLabel).fill('Plan for the year');
  await dialog.getByRole('button', { name: en.metrics.recordThreshold }).click();
  await expect(dialog).toBeHidden();
}

test('a leader adds three metrics, one per direction, with thresholds', async ({
  page,
  request,
}) => {
  const suffix = uniqueSuffix();
  const leader = `e2e.lead.${suffix}@example.com`;
  const admin = await apiAs(request, ADMIN_EMAIL);
  const team = await admin.registerTeam(`E2E Metrics ${suffix}`, leader);

  await signInAs(page, leader);
  await page.goto(`/teams/${team.id}/metrics`);

  // The three ways to add a metric, in one row at the top, and no other way round.
  for (const name of [en.metrics.create, en.metrics.copy, en.metrics.include]) {
    await expect(page.getByRole('button', { name })).toBeVisible();
  }
  await expect(page.getByLabel(en.metrics.nameLabel)).toBeHidden();
  await expect(page.getByRole('link', { name: en.board.meetingsLink, exact: true })).toBeHidden();

  await addMetric(page, 'Revenue', 'mln zł', 'higher_is_better');
  await addMetric(page, 'Open bugs', 'pcs', 'lower_is_better');
  await addMetric(page, 'Utilisation', '%', 'within_band');

  // A target value other than 0 takes tolerances, and the form shows what
  // they amount to before the version is recorded.
  await page.getByRole('button', { name: 'Change threshold: Revenue' }).click();
  const revenue = page.getByRole('dialog', { name: 'New threshold for Revenue' });
  await revenue.getByLabel(en.metrics.targetValueLabel, { exact: true }).fill('200');
  await expect(revenue.getByLabel(en.metrics.greenFrom, { exact: true })).toBeHidden();
  await revenue.getByLabel(en.metrics.greenPctLabel, { exact: true }).fill('10');
  await revenue.getByLabel(en.metrics.amberPctLabel, { exact: true }).fill('20');
  await expect(revenue).toContainText(
    'Amounts to: Green from 180.0 mln zł, amber from 160.0 mln zł',
  );
  await revenue.getByRole('button', { name: en.metrics.cancel }).click();
  await expect(revenue).toBeHidden();

  await setThreshold(page, 'Revenue', '200', [
    [en.metrics.greenPctLabel, '10'],
    [en.metrics.amberPctLabel, '20'],
  ]);
  // A target value of 0 asks for the boundaries instead.
  await setThreshold(page, 'Open bugs', '0', [
    [en.metrics.greenUpTo, '5'],
    [en.metrics.amberUpTo, '10'],
  ]);
  await setThreshold(page, 'Utilisation', '80', [
    [en.metrics.greenPctLabel, '5'],
    [en.metrics.amberPctLabel, '10'],
  ]);

  const row = (name: string) => page.getByRole('listitem').filter({ hasText: name });
  await expect(row('Revenue')).toContainText('Target value 200.0 mln zł · green −10% · amber −20%');
  await expect(row('Open bugs')).toContainText('Green up to 5.0 pcs, amber up to 10.0 pcs');
  await expect(row('Utilisation')).toContainText('Target value 80.0 % · green ±5% · amber ±10%');

  // A band with a target value of 0 takes its four boundaries.
  await setThreshold(page, 'Utilisation', '0', [
    [en.metrics.greenFrom, '71'],
    [en.metrics.greenTo, '72'],
    [en.metrics.amberFrom, '70.5'],
    [en.metrics.amberTo, '72.5'],
  ]);
  await expect(row('Utilisation')).toContainText('Green 71.0 % to 72.0 %, amber 70.5 % to 72.5 %');

  // An amber tolerance tighter than green is refused, and says why.
  await page.getByRole('button', { name: 'Change threshold: Revenue' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(en.metrics.targetValueLabel, { exact: true }).fill('200');
  await dialog.getByLabel(en.metrics.greenPctLabel, { exact: true }).fill('20');
  await dialog.getByLabel(en.metrics.amberPctLabel, { exact: true }).fill('10');
  await dialog.getByLabel(en.metrics.reasonLabel).fill('Typo');
  await dialog.getByRole('button', { name: en.metrics.recordThreshold }).click();
  await expect(dialog.getByRole('alert')).toHaveText(en.errors['threshold.order_invalid']);

  // So are boundaries in the wrong order, for a target value of 0.
  await dialog.getByLabel(en.metrics.targetValueLabel, { exact: true }).fill('0');
  await dialog.getByLabel(en.metrics.greenFrom, { exact: true }).fill('100');
  await dialog.getByLabel(en.metrics.amberFrom, { exact: true }).fill('150');
  await dialog.getByRole('button', { name: en.metrics.recordThreshold }).click();
  await expect(dialog.getByRole('alert')).toHaveText(en.errors['threshold.order_invalid']);
  await dialog.getByRole('button', { name: en.metrics.cancel }).click();
  await expect(dialog).toBeHidden();

  // Hiding a metric marks its row and holds after a reload.
  const hide = page.getByRole('switch', { name: 'Hidden on board: Open bugs' });
  await expect(hide).not.toBeChecked();
  await expect(row('Open bugs').getByText(en.metrics.hiddenMark, { exact: true })).toBeHidden();
  // The switch follows the saved state, so it turns on once the board has it.
  await hide.click();
  await expect(hide).toBeChecked();
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Hidden on board: Open bugs' })).toBeChecked();
  await expect(row('Open bugs').getByText(en.metrics.hiddenMark, { exact: true })).toBeVisible();
  await expect(row('Revenue').getByText(en.metrics.hiddenMark, { exact: true })).toBeHidden();
});

test('a leader copies a metric with its threshold from another board', async ({
  page,
  request,
}) => {
  const suffix = uniqueSuffix();
  const leader = `e2e.lead.${suffix}@example.com`;
  const otherLeader = `e2e.other.${suffix}@example.com`;
  const admin = await apiAs(request, ADMIN_EMAIL);
  const source = await admin.registerTeam(`E2E Copy source ${suffix}`, otherLeader);
  const team = await admin.registerTeam(`E2E Copy target ${suffix}`, leader);
  const leadTime = await admin.addMetric(source.id, {
    name: 'Lead time',
    unit: 'd',
    decimals: 1,
    direction: 'lower_is_better',
  });
  await admin.addThreshold(source.id, leadTime.id, {
    effective_from: '2026-01-01',
    reason: 'Plan for the year',
    target_value: '0',
    green: '3',
    amber: '5',
  });

  await signInAs(page, leader);
  await page.goto(`/teams/${team.id}/metrics`);
  await page.getByRole('button', { name: en.metrics.copy }).click();
  const dialog = page.getByRole('dialog', { name: en.metrics.copy });
  await dialog
    .getByLabel(en.metrics.copyTeamLabel)
    .selectOption({ label: `E2E Copy source ${suffix}` });
  await dialog.getByLabel(en.metrics.copySourceLabel).selectOption({ label: 'Lead time' });
  await dialog.getByRole('button', { name: en.metrics.copySubmit }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByRole('listitem').filter({ hasText: 'Lead time' });
  await expect(row).toBeVisible();
  await expect(row).not.toContainText(en.metrics.global);
  await expect(row).toContainText('Green up to 3.0 d, amber up to 5.0 d');
});

async function addGroup(page: Page, name: string) {
  await page.getByRole('button', { name: en.metrics.addGroup }).click();
  const dialog = page.getByRole('dialog', { name: en.metrics.addGroup });
  await dialog.getByLabel(en.metrics.groupNameLabel).fill(name);
  await dialog.getByRole('button', { name: en.metrics.addGroup }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('region', { name, exact: true })).toBeVisible();
}

test('a leader arranges the board into groups by dragging and from the keyboard', async ({
  page,
  request,
}) => {
  const suffix = uniqueSuffix();
  const leader = `e2e.lead.${suffix}@example.com`;
  const admin = await apiAs(request, ADMIN_EMAIL);
  const team = await admin.registerTeam(`E2E Groups ${suffix}`, leader);
  for (const name of ['Revenue', 'Open bugs']) {
    await admin.addMetric(team.id, {
      name,
      unit: 'pcs',
      decimals: 0,
      direction: 'higher_is_better',
    });
  }
  await admin.openMeeting(team.id, addDays(organizationToday(), 3));

  await signInAs(page, leader);
  await page.goto(`/teams/${team.id}/metrics`);
  await addGroup(page, 'Quality');
  await addGroup(page, 'Finance');
  await addGroup(page, 'Spare');

  // Dragged out of the ungrouped metrics into Quality.
  const quality = page.getByRole('region', { name: 'Quality', exact: true });
  await page.getByRole('listitem').filter({ hasText: 'Revenue' }).dragTo(quality);
  await expect(quality.getByRole('listitem').filter({ hasText: 'Revenue' })).toBeVisible();

  // The same arrangement without dragging.
  await page.getByLabel('Move to group: Open bugs').selectOption({ label: 'Finance' });
  const finance = page.getByRole('region', { name: 'Finance', exact: true });
  await expect(finance.getByRole('listitem').filter({ hasText: 'Open bugs' })).toBeVisible();
  await page.getByRole('button', { name: 'Move group up: Finance' }).click();
  await expect(page.locator('[aria-live="polite"]')).toContainText(
    'Group Finance moved to position 1 of 3.',
  );

  // An empty group goes without asking.
  await page.getByRole('button', { name: 'Delete group: Spare' }).click();
  await expect(page.getByRole('region', { name: 'Spare', exact: true })).toBeHidden();

  // The board follows the layout: Finance before Quality, nothing ungrouped.
  await page.goto(`/teams/${team.id}`);
  await expect(page.getByRole('heading', { name: 'Revenue', level: 3 })).toBeVisible();
  const sections = page.locator('section').filter({ has: page.getByRole('heading', { level: 3 }) });
  await expect(sections.getByRole('heading', { level: 2 })).toHaveText(['Finance', 'Quality']);
  await expect(page.getByRole('region', { name: 'Finance', exact: true })).toContainText(
    'Open bugs',
  );
  await expect(page.getByRole('region', { name: 'Quality', exact: true })).toContainText('Revenue');
});

test('a leader derives a metric as the mean of two, one from another team', async ({
  page,
  request,
}) => {
  const suffix = uniqueSuffix();
  const leader = `e2e.lead.${suffix}@example.com`;
  const otherLeader = `e2e.other.${suffix}@example.com`;
  const otherName = `E2E CKI-P ${suffix}`;
  const admin = await apiAs(request, ADMIN_EMAIL);
  const team = await admin.registerTeam(`E2E Derived ${suffix}`, leader);
  const other = await admin.registerTeam(otherName, otherLeader);
  const metric = (name: string) => ({
    name,
    unit: '%',
    decimals: 1,
    direction: 'higher_is_better',
  });
  await admin.addMetric(team.id, metric('OTIF E'));
  await admin.addMetric(team.id, metric('OTIF E: BPW'));
  await admin.addMetric(other.id, metric('OTIF-Etap'));

  await signInAs(page, leader);
  await page.goto(`/teams/${team.id}/metrics`);
  const edit = page.getByRole('button', { name: 'Edit: OTIF E', exact: true });
  const row = page.getByRole('listitem').filter({ has: edit });
  await edit.click();
  await row
    .getByLabel(en.metrics.derivationKindLabel)
    .selectOption({ label: en.metrics.kind_mean });

  // A source is a team, the board's own offered first, then a metric of its board.
  await row.getByRole('button', { name: en.metrics.addSource }).click();
  await expect(row.getByLabel('Source 1: team')).toHaveValue(team.id);
  await row.getByLabel('Source 1: metric').selectOption({ label: 'OTIF E: BPW' });
  await row.getByRole('button', { name: en.metrics.addSource }).click();
  await row.getByLabel('Source 2: team').selectOption({ label: otherName });
  await row.getByLabel('Source 2: metric').selectOption({ label: 'OTIF-Etap' });
  await row.getByRole('button', { name: en.metrics.save, exact: true }).click();
  await expect(row.getByLabel(en.metrics.derivationKindLabel)).toBeHidden();

  // The row reads as the mean of two, and names them in order on expand.
  await expect(row).toContainText('Mean of 2 metrics');
  await row.getByText('Mean of 2 metrics').click();
  await expect(row.getByRole('listitem')).toHaveText(['OTIF E: BPW', `OTIF-Etap (${otherName})`]);

  // The derivation was saved, not only shown.
  await page.reload();
  await expect(row).toContainText('Mean of 2 metrics');
});
