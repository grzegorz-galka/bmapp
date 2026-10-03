/**
 * Requirement: The interface offers only what its viewer may do.
 *
 * Through the real stack, so what is on the page and what the API would allow
 * are the same decision rather than two that happen to agree.
 */
import { expect, test, type Page } from '@playwright/test';
import { en } from '../src/i18n/en';
import { ADMIN_EMAIL, signInAs } from './auth';

function uniqueTeamName() {
  return `E2E Perm ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function uniqueEmail(prefix: string) {
  return `e2e.${prefix}.${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
}

/** Register a team as the administrator and return its members-page address. */
async function registerTeam(page: Page, name: string, leaderEmail: string): Promise<string> {
  await page.goto('/teams');
  await page.getByLabel(en.teams.nameLabel).fill(name);
  await page.getByLabel(en.teams.leaderEmailLabel).fill(leaderEmail);
  await page.getByRole('button', { name: en.teams.register }).click();

  const link = page.getByRole('link', {
    name: en.teams.membersLinkLabel.replace('{{name}}', name),
  });
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  return href ?? '';
}

test('an administrator is offered team registration and every member control', async ({ page }) => {
  const name = uniqueTeamName();
  const leaderEmail = uniqueEmail('lead');
  await signInAs(page, ADMIN_EMAIL);

  const membersPath = await registerTeam(page, name, leaderEmail);
  await page.goto(membersPath);

  await expect(page.getByRole('button', { name: en.members.add })).toBeVisible();
});

test('someone who is not an administrator is not offered team registration', async ({ page }) => {
  const name = uniqueTeamName();
  const leaderEmail = uniqueEmail('lead');
  await signInAs(page, ADMIN_EMAIL);
  await registerTeam(page, name, leaderEmail);

  // Come back as an ordinary person, who may read the list and nothing more.
  await signInAs(page, uniqueEmail('nobody'));
  await page.goto('/teams');

  await expect(page.getByRole('heading', { name: en.teams.heading })).toBeVisible();
  await expect(page.getByRole('button', { name: en.teams.register })).toBeHidden();
  // Reading is open to anyone signed in, so the team is still listed.
  await expect(
    page.getByRole('link', { name: en.teams.membersLinkLabel.replace('{{name}}', name) }),
  ).toBeVisible();
});

test('a leader is offered membership management on their own team', async ({ page }) => {
  const name = uniqueTeamName();
  const leaderEmail = uniqueEmail('lead');
  await signInAs(page, ADMIN_EMAIL);
  const membersPath = await registerTeam(page, name, leaderEmail);

  await signInAs(page, leaderEmail);
  await page.goto(membersPath);

  await expect(page.getByRole('button', { name: en.members.add })).toBeVisible();
});

test('an ordinary member is offered no membership control', async ({ page }) => {
  const name = uniqueTeamName();
  const leaderEmail = uniqueEmail('lead');
  const memberEmail = uniqueEmail('member');
  await signInAs(page, ADMIN_EMAIL);
  const membersPath = await registerTeam(page, name, leaderEmail);
  await page.goto(membersPath);
  await page.getByLabel(en.members.emailLabel).fill(memberEmail);
  await page.getByRole('button', { name: en.members.add }).click();
  await expect(page.getByText(memberEmail)).toBeVisible();

  await signInAs(page, memberEmail);
  await page.goto(membersPath);

  // The page and its members are still readable; the controls are not offered.
  await expect(page.getByText(leaderEmail)).toBeVisible();
  await expect(page.getByRole('button', { name: en.members.add })).toBeHidden();
});
