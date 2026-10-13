import { expect, test, type Page } from '@playwright/test';
import { en } from '../src/i18n/en';
import { ADMIN_EMAIL, signInAs } from './auth';
import { apiAs, uniqueSuffix } from './api';

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

async function setThreshold(page: Page, name: string, bounds: [string, string][]) {
  await page.getByRole('button', { name: `Change threshold: ${name}` }).click();
  const dialog = page.getByRole('dialog', { name: `New threshold for ${name}` });
  await dialog.getByLabel(en.metrics.effectiveFromLabel).fill('2026-01-01');
  for (const [label, value] of bounds) {
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

  await setThreshold(page, 'Revenue', [
    [en.metrics.greenFrom, '165'],
    [en.metrics.amberFrom, '150'],
  ]);
  await setThreshold(page, 'Open bugs', [
    [en.metrics.greenUpTo, '5'],
    [en.metrics.amberUpTo, '10'],
  ]);
  await setThreshold(page, 'Utilisation', [
    [en.metrics.greenFrom, '71'],
    [en.metrics.greenTo, '72'],
    [en.metrics.amberFrom, '70.5'],
    [en.metrics.amberTo, '72.5'],
  ]);

  const row = (name: string) => page.getByRole('listitem').filter({ hasText: name });
  await expect(row('Revenue')).toContainText('Green from 165.0 mln zł, amber from 150.0 mln zł');
  await expect(row('Open bugs')).toContainText('Green up to 5.0 pcs, amber up to 10.0 pcs');
  await expect(row('Utilisation')).toContainText('Green 71.0 % to 72.0 %, amber 70.5 % to 72.5 %');

  // Boundaries in the wrong order are refused, and say why.
  await page.getByRole('button', { name: 'Change threshold: Revenue' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(en.metrics.greenFrom, { exact: true }).fill('100');
  await dialog.getByLabel(en.metrics.amberFrom, { exact: true }).fill('150');
  await dialog.getByLabel(en.metrics.reasonLabel).fill('Typo');
  await dialog.getByRole('button', { name: en.metrics.recordThreshold }).click();
  await expect(dialog.getByRole('alert')).toHaveText(en.errors['threshold.order_invalid']);
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
