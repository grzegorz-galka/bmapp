import { expect, test } from '@playwright/test';
import { en } from '../src/i18n/en';
import { organizationToday } from '../src/features/board/organizationDate';
import { ADMIN_EMAIL, signInAs } from './auth';
import { addDays, apiAs, uniqueSuffix } from './api';

/*
 * A global metric from definition to a coloured tile: an administrator adds it
 * to the catalogue with a threshold, a team's leader includes it in the
 * board, and a member records a value at the coming meeting.
 *
 * Global metric names are unique company-wide and the stack keeps its data
 * between runs, so the name carries the run's suffix.
 */

/** An English caption with its placeholders filled in. */
function caption(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '');
}

test('a global metric is defined, included in a board and recorded there', async ({
  page,
  request,
}) => {
  const suffix = uniqueSuffix();
  const leader = `e2e.lead.${suffix}@example.com`;
  const member = `e2e.member.${suffix}@example.com`;
  const name = `Availability ${suffix}`;

  const admin = await apiAs(request, ADMIN_EMAIL);
  const team = await admin.registerTeam(`E2E Global ${suffix}`, leader);
  await admin.addMember(team.id, member);
  await admin.openMeeting(team.id, addDays(organizationToday(), 3));

  // The administrator defines the metric and its threshold in the catalogue.
  await signInAs(page, ADMIN_EMAIL);
  await page.goto('/global-metrics');
  await expect(page.getByRole('heading', { name: en.globalMetrics.heading })).toBeVisible();
  await page.getByLabel(en.metrics.nameLabel).fill(name);
  await page.getByLabel(en.metrics.unitLabel).fill('%');
  await page.getByLabel(en.metrics.decimalsLabel).fill('1');
  await page.getByLabel(en.metrics.directionLabel).selectOption('higher_is_better');
  await page.getByRole('button', { name: en.globalMetrics.add, exact: true }).click();
  const row = page
    .getByRole('list', { name: en.globalMetrics.listLabel })
    .getByRole('listitem')
    .filter({ hasText: name });
  await expect(row).toBeVisible();

  await page
    .getByRole('button', { name: caption(en.metrics.changeThresholdLabel, { name }) })
    .click();
  const dialog = page.getByRole('dialog', {
    name: caption(en.metrics.thresholdHeading, { name }),
  });
  await dialog.getByLabel(en.metrics.effectiveFromLabel).fill('2026-01-01');
  await dialog.getByLabel(en.metrics.greenFrom, { exact: true }).fill('99');
  await dialog.getByLabel(en.metrics.amberFrom, { exact: true }).fill('95');
  await dialog.getByLabel(en.metrics.reasonLabel).fill('Company plan');
  await dialog.getByRole('button', { name: en.metrics.recordThreshold }).click();
  await expect(dialog).toBeHidden();
  const threshold = caption(en.threshold.higher_is_better, {
    green: '99.0 %',
    amber: '95.0 %',
  });
  await expect(row).toContainText(threshold);

  // The leader includes it in the board, through the settings page.
  await signInAs(page, leader);
  await page.goto(`/teams/${team.id}/metrics`);
  await page.getByRole('button', { name: en.metrics.include }).click();
  const include = page.getByRole('dialog', { name: en.metrics.include });
  await include.getByLabel(en.metrics.includeSourceLabel).selectOption({ label: name });
  await include.getByLabel(en.metrics.ownerLabel).selectOption({ label: member });
  await include.getByRole('button', { name: en.metrics.includeSubmit }).click();
  await expect(include).toBeHidden();
  const setting = page.getByRole('listitem').filter({ hasText: name });
  await expect(setting).toContainText(en.metrics.global);
  await expect(setting).toContainText(threshold);
  await expect(setting).toContainText(en.metrics.globalNote);

  // A member records a value at the coming meeting and sees it judged.
  await signInAs(page, member);
  await page.goto(`/teams/${team.id}`);
  await page.getByRole('button', { name: en.board.record }).click();
  await page.getByRole('textbox', { name: caption(en.recording.valueLabel, { name }) }).fill('97');
  await page.getByRole('textbox', { name: caption(en.recording.commentLabel, { name }) }).click();
  await expect(page.getByText(en.recording.saved).first()).toBeVisible();

  await page.getByRole('button', { name: en.board.showTiles }).click();
  const tile = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name }) });
  await expect(tile).toContainText('97.0 %');
  await expect(tile).toContainText(en.status.amber);
  await expect(tile).toHaveAttribute('data-status', 'amber');
  await expect(tile).toContainText(en.metrics.global);
  await expect(tile).toContainText(threshold);
});
