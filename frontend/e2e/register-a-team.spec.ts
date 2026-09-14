import { expect, test, type Page } from '@playwright/test';
import { en, type Translations } from '../src/i18n/en';
import { pl } from '../src/i18n/pl';
import { LANGUAGE_STORAGE_KEY } from '../src/i18n/languages';

/** A name no other run will collide with, since the stack keeps its data. */
function uniqueTeamName() {
  return `E2E Team ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/**
 * A list entry as the page composes it: the team's name, then the board
 * suffix from the catalogue. Built from the catalogue rather than spelled out,
 * so rewording the suffix in either language is not an edit here.
 */
function entryText(catalogue: Translations, name: string) {
  return `${name} \u2014 ${catalogue.teams.boardSuffix.replace('{{name}}', name)}`;
}

/**
 * Pin the language before the app boots.
 *
 * Seeding the remembered choice rather than setting the browser locale: it is
 * the first step of the app's own resolution order, so the run does not depend
 * on what languages the CI browser happens to advertise.
 *
 * The script runs again on every navigation, so it seeds only when nothing is
 * remembered yet: a language the test then chooses in the app must survive a
 * reload rather than being overwritten by the seed.
 */
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

test('a registered team appears in the list and survives a reload', async ({ page }) => {
  const name = uniqueTeamName();
  await useLanguage(page, 'en');

  await page.goto('/');
  await expect(page.getByRole('heading', { name: en.teams.heading })).toBeVisible();

  await page.getByLabel(en.teams.nameLabel).fill(name);
  await page.getByRole('button', { name: en.teams.register }).click();

  const entry = page.getByRole('listitem').filter({ hasText: name });
  await expect(entry).toHaveText(entryText(en, name));

  await page.reload();
  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible();
});

test('a duplicate name is reported against the name field', async ({ page }) => {
  const name = uniqueTeamName();
  await useLanguage(page, 'en');

  await page.goto('/');
  await page.getByLabel(en.teams.nameLabel).fill(name);
  await page.getByRole('button', { name: en.teams.register }).click();
  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible();

  await page.getByLabel(en.teams.nameLabel).fill(name.toUpperCase());
  await page.getByRole('button', { name: en.teams.register }).click();

  await expect(page.getByRole('alert')).toHaveText(en.errors['team_name.duplicate']);
  await expect(page.getByLabel(en.teams.nameLabel)).toHaveAttribute('aria-invalid', 'true');
});

test('the whole flow reads in Polish, error included', async ({ page }) => {
  const name = uniqueTeamName();
  await useLanguage(page, 'pl');

  await page.goto('/');
  await expect(page.getByRole('heading', { name: pl.teams.heading })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');

  await page.getByLabel(pl.teams.nameLabel).fill(name);
  await page.getByRole('button', { name: pl.teams.register }).click();
  await expect(page.getByRole('listitem').filter({ hasText: name })).toHaveText(
    entryText(pl, name),
  );

  // The duplicate rejection comes from Postgres, through the API's code, and
  // arrives as a Polish sentence. That is the whole point of the change.
  await page.getByLabel(pl.teams.nameLabel).fill(name.toUpperCase());
  await page.getByRole('button', { name: pl.teams.register }).click();

  await expect(page.getByRole('alert')).toHaveText(pl.errors['team_name.duplicate']);
  // The one English literal here on purpose: a fragment of the API's
  // developer-facing `message`, asserted absent rather than displayed.
  await expect(page.locator('body')).not.toContainText('already exists');
});

test('the language can be switched in the running app', async ({ page }) => {
  await useLanguage(page, 'en');

  await page.goto('/');
  await expect(page.getByRole('heading', { name: en.teams.heading })).toBeVisible();

  await page.getByLabel(en.language.label).selectOption('pl');

  await expect(page.getByRole('heading', { name: pl.teams.heading })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');

  // The choice is remembered, so a reload comes back in Polish.
  await page.reload();
  await expect(page.getByRole('heading', { name: pl.teams.heading })).toBeVisible();
});
