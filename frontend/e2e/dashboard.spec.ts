import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { en } from '../src/i18n/en';
import { pl } from '../src/i18n/pl';
import { LANGUAGE_STORAGE_KEY } from '../src/i18n/languages';
import { THEME_STORAGE_KEY } from '../src/theme/themes';
import { organizationToday } from '../src/features/board/organizationDate';
import { ADMIN_EMAIL, signInAs } from './auth';
import { addDays, apiAs, isoWeekday, uniqueSuffix } from './api';

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

/**
 * A team of its own for the viewer, who leads it: it meets on the weekday three
 * days from today and has opened no meeting, so the dashboard proposes one.
 * Everything the dashboard shows is recorded data now, so a run sets up what it
 * reads instead of relying on what earlier runs left behind.
 */
async function scene(request: APIRequestContext) {
  const suffix = uniqueSuffix();
  const viewer = `e2e.dashboard.${suffix}@example.com`;
  const today = organizationToday();
  const proposed = addDays(today, 3);
  const admin = await apiAs(request, ADMIN_EMAIL);
  const team = await admin.registerTeam(`E2E Dashboard ${suffix}`, viewer);
  const leader = await apiAs(request, viewer);
  await leader.setSchedule(team.id, isoWeekday(proposed), '13:00');
  return { suffix, viewer, today, proposed, team, teamName: `E2E Dashboard ${suffix}`, leader };
}

function meetingRow(page: Page, teamName: string) {
  return page
    .getByRole('region', { name: en.meetingsTile.heading })
    .getByRole('listitem')
    .filter({ hasText: teamName })
    .filter({ has: page.getByRole('button') });
}

test('the dashboard shows the declarations, the teams and the assigned items', async ({
  page,
  request,
}) => {
  const { viewer, teamName } = await scene(request);
  await useLanguage(page, 'en');
  await signInAs(page, viewer);

  await page.goto('/');

  await expect(page.getByRole('heading', { name: en.dashboard.heroTitle })).toBeVisible();

  // The company declarations, from the API in both languages.
  await expect(page.getByRole('heading', { name: en.declarations.band })).toBeVisible();
  await expect(page.getByRole('heading', { name: en.declarations.mission })).toBeVisible();
  await expect(page.getByText(en.declarations.bandNote)).toBeVisible();
  await expect(
    page.getByText('We are here to change the energy sector for the better'),
  ).toBeVisible();
  const band = page.getByRole('region', { name: en.declarations.band });
  for (const value of ['Effectiveness', 'Passion', 'Innovation', 'Collaboration']) {
    await expect(band.getByText(value, { exact: true })).toBeVisible();
  }
  for (const heading of [en.declarations.values, en.declarations.strategy, en.declarations.goals]) {
    await expect(band.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await expect(band.getByText('Customer satisfaction: NPS 50+')).toBeVisible();

  // The viewer's team, with a countdown to its proposed meeting.
  const teams = page.getByRole('region', { name: en.myTeams.heading, exact: true });
  await expect(teams.getByText(teamName).first()).toBeVisible();
  await expect(teams).toContainText(en.myTeams.role_leader);
  const timer = page.getByRole('timer', { name: en.myTeams.countdownLabel });
  await expect(timer).toBeVisible();
  await expect(timer).not.toContainText('-');

  // The proposed meeting, not yet opened, and the problems and tasks tile.
  await expect(meetingRow(page, teamName)).toContainText(en.meetingsTile.notOpened);
  const items = page.getByRole('region', { name: en.itemsTile.heading });
  await expect(items.getByText(en.itemsTile.footRight)).toBeVisible();
  await expect(items.getByText(en.itemsTile.assignedTo.replace('{{email}}', viewer))).toBeVisible();
  await expect(items.getByText(en.itemsTile.empty)).toBeVisible();
});

test('preparing data on a proposed meeting opens it in the recording view', async ({
  page,
  request,
}) => {
  const { viewer, teamName, team, leader } = await scene(request);
  // The board offers the recording view only once it has a metric to record.
  await leader.addMetric(team.id, {
    name: 'Open bugs',
    unit: 'pcs',
    decimals: 0,
    direction: 'lower_is_better',
  });
  await useLanguage(page, 'en');
  await signInAs(page, viewer);
  await page.goto('/');

  const row = meetingRow(page, teamName);
  await expect(row).toContainText(en.meetingsTile.notOpened);
  // Three days ahead, so it is not today's and cannot be started yet.
  await expect(row.getByRole('button', { name: en.meetingsTile.start })).toHaveCount(0);
  await row.getByRole('button', { name: en.meetingsTile.prepare }).click();

  await expect(page).toHaveURL(
    new RegExp(`/teams/${team.id}\\?meeting=[0-9a-f-]{36}&mode=record$`),
  );
  await expect(
    page.getByRole('heading', { name: en.recording.heading.split('{{')[0] }),
  ).toBeVisible();

  // The meeting now exists, so back on the dashboard the row is no longer a proposal.
  await page.goto('/');
  await expect(meetingRow(page, teamName)).not.toContainText(en.meetingsTile.notOpened);
  await expect(meetingRow(page, teamName)).toContainText(
    en.meetingsTile.recorded.replace('{{recorded}}', '0').replace('{{total}}', '1'),
  );
});

test('filling the pulse check opens the answer form', async ({ page, request }) => {
  const { viewer, teamName, team, leader, proposed } = await scene(request);
  const meeting = await leader.openMeeting(team.id, proposed);
  await useLanguage(page, 'en');
  await signInAs(page, viewer);
  await page.goto('/');

  const row = meetingRow(page, teamName);
  await expect(row).toContainText(en.meetingsTile.pulseNotAnswered);
  await row.getByRole('button', { name: en.meetingsTile.fillPulse }).click();

  await expect(page).toHaveURL(
    new RegExp(`/teams/${team.id}\\?meeting=${meeting.id}&view=pulse&mode=answer$`),
  );
  await expect(
    page.getByRole('heading', { name: en.pulse.formHeading.split('{{')[0] }),
  ).toBeVisible();
});

test("an assigned task leads to the board's tasks list", async ({ page, request }) => {
  const { viewer, teamName, team, leader } = await scene(request);
  const me = (await leader.team(team.id)).members.find((member) => member.email === viewer)!;
  const summary = `Separate test database ${uniqueSuffix()}`;
  await leader.raiseTask(team.id, { summary, responsible_employee_id: me.employee_id });
  await useLanguage(page, 'en');
  await signInAs(page, viewer);
  await page.goto('/');

  const items = page.getByRole('region', { name: en.itemsTile.heading });
  const link = items.getByRole('link', { name: summary });
  await expect(link).toBeVisible();
  await expect(items).toContainText(teamName);
  await link.click();

  await expect(page).toHaveURL(new RegExp(`/teams/${team.id}#tasks$`));
  await expect(
    page.getByRole('heading', { name: en.items.tasksHeading, exact: true }),
  ).toBeInViewport();
});

test('the dashboard reads in Polish and switches back without a reload', async ({ page }) => {
  await signInAs(page);
  await useLanguage(page, 'en');

  await page.goto('/');
  await expect(page.getByRole('heading', { name: en.dashboard.heroTitle })).toBeVisible();

  await page.getByRole('button', { name: en.language.switchToPl }).click();

  await expect(page.getByRole('heading', { name: pl.dashboard.heroTitle })).toBeVisible();
  await expect(page.getByRole('heading', { name: pl.meetingsTile.heading })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  // The declarations came from the API carrying both languages, so they follow.
  await expect(page.getByRole('heading', { name: pl.declarations.mission })).toBeVisible();
  await expect(page.getByText('Jesteśmy po to, aby zmieniać energetykę na lepsze')).toBeVisible();

  await page.getByRole('button', { name: pl.language.switchToEn }).click();

  await expect(page.getByRole('heading', { name: en.dashboard.heroTitle })).toBeVisible();
});

test('the theme can be toggled and the choice is remembered', async ({ page }) => {
  await signInAs(page);
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
  await signInAs(page);
  await useLanguage(page, 'en');

  await page.goto('/');
  const nav = page.getByRole('navigation', { name: en.nav.label });

  const configuration = nav.getByRole('button', { name: en.nav.configuration });
  await configuration.click();
  await expect(configuration).toHaveAttribute('aria-expanded', 'true');
  await nav.getByRole('link', { name: en.nav.teams, exact: true }).click();

  await expect(page).toHaveURL(/\/teams$/);
  await expect(page.getByRole('heading', { name: en.teams.heading, exact: true })).toBeVisible();
  await expect(configuration).toHaveAttribute('aria-current', 'page');

  await nav.getByRole('link', { name: en.nav.dashboard }).click();

  await expect(page.getByRole('heading', { name: en.dashboard.heroTitle })).toBeVisible();
});

test('the navigation names what a person does, and no archive', async ({ page }) => {
  await signInAs(page);
  await useLanguage(page, 'en');

  await page.goto('/');
  const nav = page.getByRole('navigation', { name: en.nav.label });

  await expect(nav.getByRole('link', { name: en.nav.dashboard })).toBeVisible();
  for (const name of [en.nav.myTeams, en.nav.myMeetings, en.nav.myPulse]) {
    await expect(nav.getByRole('link', { name })).toBeVisible();
  }
  await expect(nav.getByText(/archive/i)).toHaveCount(0);

  await nav.getByRole('link', { name: en.nav.myMeetings }).click();
  await expect(page).toHaveURL(/\/my-meetings$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: en.personal.meetingsHeading })).toBeVisible();
});

test('an address nobody recognises lands on the dashboard', async ({ page }) => {
  await signInAs(page);
  await useLanguage(page, 'en');

  await page.goto('/no-such-page');

  await expect(page.getByRole('heading', { name: en.dashboard.heroTitle })).toBeVisible();
});

test('the dashboard has no horizontal scroll on a narrow screen', async ({ page }) => {
  await signInAs(page);
  await useLanguage(page, 'en');
  await page.setViewportSize({ width: 400, height: 900 });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: en.dashboard.heroTitle })).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
});
