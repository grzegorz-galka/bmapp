import { expect, test, type Page } from '@playwright/test';
import { en } from '../src/i18n/en';
import { pl } from '../src/i18n/pl';
import { LANGUAGE_STORAGE_KEY } from '../src/i18n/languages';
import { THEME_STORAGE_KEY } from '../src/theme/themes';

/**
 * Pin the language before the app boots, the way the team-board spec does:
 * seeding the remembered choice is the first step of the app's own resolution
 * order, so the run does not depend on the CI browser's advertised locales.
 *
 * Seeds only when nothing is remembered, so a choice the test makes in the app
 * survives a reload rather than being overwritten.
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

test('the hub shows the declarations, the teams and the assigned items', async ({ page }) => {
  await useLanguage(page, 'en');

  await page.goto('/');

  await expect(page.getByRole('heading', { name: en.hub.heroTitle })).toBeVisible();

  // The company declarations, from the API in both languages.
  await expect(page.getByRole('heading', { name: en.declarations.band })).toBeVisible();
  await expect(page.getByRole('heading', { name: en.declarations.mission })).toBeVisible();
  await expect(page.getByText(en.declarations.bandNote)).toBeVisible();

  // The teams, with a countdown to the nearest meeting.
  const teams = page.getByRole('region', { name: en.myTeams.heading });
  await expect(teams).toBeVisible();
  await expect(teams.getByText('Platform Core')).toBeVisible();
  await expect(page.getByRole('timer', { name: en.myTeams.countdownLabel })).toBeVisible();

  // The funnel and the items assigned to the placeholder identity.
  await expect(page.getByRole('heading', { name: en.funnel.heading })).toBeVisible();
  await expect(page.getByText(en.funnel.footRight)).toBeVisible();
  const items = page.getByRole('region', { name: en.items.heading });
  await expect(items.getByText(en.items.overdue)).toBeVisible();

  // And it says outright that none of this is recorded data.
  await expect(page.getByText(en.hub.provisional)).toBeVisible();
});

test('the countdown never runs backwards', async ({ page }) => {
  await useLanguage(page, 'en');

  await page.goto('/');
  const timer = page.getByRole('timer', { name: en.myTeams.countdownLabel });

  // The server computes the next occurrence per request, so whenever this runs
  // the nearest meeting is ahead and no unit reads as a negative.
  await expect(timer).toBeVisible();
  await expect(timer).not.toContainText('-');
});

test('the hub reads in Polish and switches back without a reload', async ({ page }) => {
  await useLanguage(page, 'en');

  await page.goto('/');
  await expect(page.getByRole('heading', { name: en.hub.heroTitle })).toBeVisible();

  await page.getByLabel(en.language.label).selectOption('pl');

  await expect(page.getByRole('heading', { name: pl.hub.heroTitle })).toBeVisible();
  await expect(page.getByRole('heading', { name: pl.tiles.conductTitle })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  // The declarations came from the API carrying both languages, so they follow.
  await expect(page.getByRole('heading', { name: pl.declarations.mission })).toBeVisible();

  await page.getByLabel(pl.language.label).selectOption('en');

  await expect(page.getByRole('heading', { name: en.hub.heroTitle })).toBeVisible();
});

test('the theme can be toggled and the choice is remembered', async ({ page }) => {
  await useLanguage(page, 'en');

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('button', { name: en.theme.switchToLight }).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(
    page.evaluate((key) => window.localStorage.getItem(key), THEME_STORAGE_KEY),
  ).resolves.toBe('light');

  // The remembered choice is applied before the bundle loads, so the reload
  // comes back light rather than flashing dark first.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: en.theme.switchToDark })).toBeVisible();
});

test('the header navigates to the team page and back', async ({ page }) => {
  await useLanguage(page, 'en');

  await page.goto('/');
  const nav = page.getByRole('navigation', { name: en.nav.label });

  await nav.getByRole('link', { name: en.nav.teams }).click();

  await expect(page).toHaveURL(/\/teams$/);
  await expect(page.getByRole('heading', { name: en.teams.heading })).toBeVisible();

  await nav.getByRole('link', { name: en.nav.hub }).click();

  await expect(page.getByRole('heading', { name: en.hub.heroTitle })).toBeVisible();
});

test('the archive is named but goes nowhere', async ({ page }) => {
  await useLanguage(page, 'en');

  await page.goto('/');
  const archive = page
    .getByRole('navigation', { name: en.nav.label })
    .getByText(en.nav.archive, { exact: false });

  await expect(archive).toHaveAttribute('aria-disabled', 'true');
  // Forced, because the browser already refuses an ordinary click on a link
  // marked aria-disabled - which is half the point. The other half is that
  // even a forced activation goes nowhere.
  await archive.click({ force: true });

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: en.hub.heroTitle })).toBeVisible();
});

test('an address nobody recognises lands on the hub', async ({ page }) => {
  await useLanguage(page, 'en');

  await page.goto('/no-such-page');

  await expect(page.getByRole('heading', { name: en.hub.heroTitle })).toBeVisible();
});

test('the hub has no horizontal scroll on a narrow screen', async ({ page }) => {
  await useLanguage(page, 'en');
  await page.setViewportSize({ width: 400, height: 900 });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: en.hub.heroTitle })).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
});
