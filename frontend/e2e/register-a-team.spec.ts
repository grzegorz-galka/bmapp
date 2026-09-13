import { expect, test } from '@playwright/test';

/** A name no other run will collide with, since the stack keeps its data. */
function uniqueTeamName() {
  return `E2E Team ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

test('a registered team appears in the list and survives a reload', async ({ page }) => {
  const name = uniqueTeamName();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible();

  await page.getByLabel('Team name').fill(name);
  await page.getByRole('button', { name: 'Register team' }).click();

  const entry = page.getByRole('listitem').filter({ hasText: name });
  await expect(entry).toHaveText(`${name} — board: ${name}`);

  await page.reload();
  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible();
});

test('a duplicate name is reported against the name field', async ({ page }) => {
  const name = uniqueTeamName();

  await page.goto('/');
  await page.getByLabel('Team name').fill(name);
  await page.getByRole('button', { name: 'Register team' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible();

  await page.getByLabel('Team name').fill(name.toUpperCase());
  await page.getByRole('button', { name: 'Register team' }).click();

  await expect(page.getByRole('alert')).toContainText('already exists');
  await expect(page.getByLabel('Team name')).toHaveAttribute('aria-invalid', 'true');
});
