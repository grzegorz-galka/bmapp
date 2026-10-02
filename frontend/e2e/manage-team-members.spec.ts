import { expect, test, type Page } from '@playwright/test';
import { en, type Translations } from '../src/i18n/en';
import { pl } from '../src/i18n/pl';
import { LANGUAGE_STORAGE_KEY } from '../src/i18n/languages';

/*
 * The members flow from the team list to a handover. The stack keeps its data
 * between runs, so every team and email is unique to the run.
 */

function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/** Seed the remembered language once, as register-a-team.spec.ts does. */
async function useLanguage(page: Page, language: 'en' | 'pl') {
  await page.addInitScript(
    ([key, value]) => {
      if (window.localStorage.getItem(key!) === null) {
        window.localStorage.setItem(key!, value!);
      }
    },
    [LANGUAGE_STORAGE_KEY, language],
  );
}

function fill(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{{${key}}}`, value),
    template,
  );
}

/** The member's row on the members page. */
function memberRow(page: Page, catalogue: Translations, email: string) {
  return page
    .getByRole('list', { name: catalogue.members.listLabel })
    .getByRole('listitem')
    .filter({ hasText: email });
}

async function addMember(page: Page, catalogue: Translations, email: string) {
  await page.getByLabel(catalogue.members.emailLabel).fill(email);
  await page.getByRole('button', { name: catalogue.members.add, exact: true }).click();
  await expect(memberRow(page, catalogue, email)).toBeVisible();
}

/**
 * Register a team, open its members page, add two members, hand the
 * leadership to one of them and remove the previous leader - all in the
 * language `catalogue` belongs to.
 */
async function handOverAndRemove(page: Page, catalogue: Translations) {
  const suffix = uniqueSuffix();
  const name = `E2E Members ${suffix}`;
  const leader = `e2e.leader.${suffix}@example.com`;
  const first = `e2e.a.${suffix}@example.com`;
  const second = `e2e.b.${suffix}@example.com`;

  await page.goto('/teams');
  await page.getByLabel(catalogue.teams.nameLabel).fill(name);
  await page.getByLabel(catalogue.teams.leaderEmailLabel).fill(leader);
  await page.getByRole('button', { name: catalogue.teams.register }).click();

  await page.getByRole('link', { name: fill(catalogue.teams.membersLinkLabel, { name }) }).click();
  await expect(
    page.getByRole('heading', { name: fill(catalogue.members.heading, { name }) }),
  ).toBeVisible();
  await expect(memberRow(page, catalogue, leader)).toContainText(catalogue.members.leader);

  await addMember(page, catalogue, first);
  await addMember(page, catalogue, second);
  await expect(memberRow(page, catalogue, first)).not.toContainText(catalogue.members.leader);

  // The leader offers no remove action until someone else leads.
  await expect(
    page.getByRole('button', { name: fill(catalogue.members.removeLabel, { email: leader }) }),
  ).toHaveCount(0);

  await page
    .getByRole('button', { name: fill(catalogue.members.makeLeaderLabel, { email: first }) })
    .click();
  await expect(memberRow(page, catalogue, first)).toContainText(catalogue.members.leader);
  await expect(memberRow(page, catalogue, leader)).not.toContainText(catalogue.members.leader);

  await page
    .getByRole('button', { name: fill(catalogue.members.removeLabel, { email: leader }) })
    .click();
  await expect(memberRow(page, catalogue, leader)).toHaveCount(0);

  // The list's member count follows: the new leader and the second member.
  await page.getByRole('link', { name: catalogue.members.back }).click();
  const entry = page.getByRole('listitem').filter({ hasText: name });
  await expect(entry).toContainText(fill(catalogue.teams.leaderSuffix, { email: first }));
  await expect(entry).toContainText(fill(catalogue.teams.memberCount, { count: '2' }));
}

test('members are added, the leadership is handed over and the old leader removed', async ({
  page,
}) => {
  await useLanguage(page, 'en');
  await handOverAndRemove(page, en);
});

test('a duplicate member is reported against the email field', async ({ page }) => {
  const suffix = uniqueSuffix();
  const name = `E2E Duplicate ${suffix}`;
  const leader = `e2e.leader.${suffix}@example.com`;
  await useLanguage(page, 'en');

  await page.goto('/teams');
  await page.getByLabel(en.teams.nameLabel).fill(name);
  await page.getByLabel(en.teams.leaderEmailLabel).fill(leader);
  await page.getByRole('button', { name: en.teams.register }).click();
  await page.getByRole('link', { name: fill(en.teams.membersLinkLabel, { name }) }).click();

  await page.getByLabel(en.members.emailLabel).fill(leader.toUpperCase());
  await page.getByRole('button', { name: en.members.add, exact: true }).click();

  await expect(page.getByRole('alert')).toHaveText(en.errors['team_member.duplicate']);
  await expect(page.getByLabel(en.members.emailLabel)).toHaveAttribute('aria-invalid', 'true');
});

test('the members flow reads in Polish', async ({ page }) => {
  await useLanguage(page, 'pl');
  await handOverAndRemove(page, pl);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
});
