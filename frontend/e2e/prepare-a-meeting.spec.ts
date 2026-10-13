import { expect, test, type Locator, type Page } from '@playwright/test';
import { en, type Translations } from '../src/i18n/en';
import { pl } from '../src/i18n/pl';
import { formatMeetingDate } from '../src/i18n/format';
import { LANGUAGE_STORAGE_KEY, type Language } from '../src/i18n/languages';
import { ADMIN_EMAIL, signInAs } from './auth';

/*
 * The meetings flow: the leader sets the schedule, then a member prepares the
 * next meeting from the proposal, names its host, moves it, and prepares the
 * one after. The stack keeps its data between runs, so every team and email
 * is unique to the run. The proposal depends on today, so the test reads what
 * was proposed rather than computing it.
 */

function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

async function seedLanguage(page: Page, language: Language) {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key!, value!);
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

function nextDay(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

/** The prepare form, apart from the schedule form's fields of the same name. */
function prepareForm(page: Page, catalogue: Translations) {
  return page.getByRole('region', { name: catalogue.meetings.prepare });
}

function meetingRow(page: Page, language: Language, date: string) {
  return page.getByRole('listitem').filter({ hasText: formatMeetingDate(date, language, '') });
}

/** A field sized to what it holds rather than to the page: no wider than 14rem. */
async function expectNarrow(field: Locator) {
  const box = await field.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(14 * 16);
}

async function prepareFromProposal(page: Page, catalogue: Translations): Promise<string> {
  await page.getByRole('button', { name: catalogue.meetings.prepare }).click();
  const date = await prepareForm(page, catalogue)
    .getByLabel(catalogue.meetings.dateLabel)
    .inputValue();
  expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await expectNarrow(prepareForm(page, catalogue).getByLabel(catalogue.meetings.dateLabel));
  await expect(prepareForm(page, catalogue).getByLabel(catalogue.meetings.timeLabel)).toHaveValue(
    '13:00',
  );
  await page.getByRole('button', { name: catalogue.meetings.open }).click();
  await expect(prepareForm(page, catalogue)).toBeHidden();
  return date;
}

async function prepareAMeeting(page: Page, language: Language) {
  const catalogue = language === 'en' ? en : pl;
  const suffix = uniqueSuffix();
  const name = `E2E Meetings ${suffix}`;
  const leader = `e2e.lead.${suffix}@example.com`;
  const member = `e2e.member.${suffix}@example.com`;
  await seedLanguage(page, language);

  // The administrator registers the team and puts the member on it.
  await signInAs(page, ADMIN_EMAIL);
  await page.goto('/teams');
  // The form opens in a section of the page from the page's own button.
  await page.getByRole('button', { name: catalogue.teams.register }).click();
  const registration = page.getByRole('region', { name: catalogue.teams.register });
  await registration.getByLabel(catalogue.teams.nameLabel).fill(name);
  await registration.getByLabel(catalogue.teams.leaderEmailLabel).fill(leader);
  await registration.getByRole('button', { name: catalogue.teams.registerSubmit }).click();
  await page.getByRole('link', { name: fill(catalogue.teams.membersLinkLabel, { name }) }).click();
  await page.getByLabel(catalogue.members.emailLabel).fill(member);
  await page.getByRole('button', { name: catalogue.members.add, exact: true }).click();
  await expect(page.getByText(member)).toBeVisible();
  const meetingsPath = page.url().replace(/\/members$/, '/meetings');

  // The leader sets the schedule, whose fields appear only when asked for.
  await signInAs(page, leader);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(meetingsPath);
  await expect(page.getByLabel(catalogue.meetings.weekdayLabel)).toBeHidden();
  await page.getByRole('button', { name: catalogue.meetings.setSchedule }).click();
  await expectNarrow(page.getByLabel(catalogue.meetings.weekdayLabel));
  await expectNarrow(page.getByLabel(catalogue.meetings.timeLabel));
  await page.getByLabel(catalogue.meetings.weekdayLabel).selectOption('3');
  await page.getByLabel(catalogue.meetings.timeLabel).fill('13:00');
  await page.getByRole('button', { name: catalogue.meetings.saveSchedule }).click();
  await expect(page.getByText(catalogue.meetings.scheduleNone)).toBeHidden();
  await expect(page.getByLabel(catalogue.meetings.weekdayLabel)).toBeHidden();
  await expect(page.getByRole('button', { name: catalogue.meetings.changeSchedule })).toBeVisible();

  // A member prepares the next meeting from the proposal and names its host.
  await signInAs(page, member);
  await page.goto(meetingsPath);
  await expect(page.getByRole('button', { name: catalogue.meetings.changeSchedule })).toBeHidden();
  const first = await prepareFromProposal(page, catalogue);
  const row = meetingRow(page, language, first);
  await expect(row).toContainText(catalogue.meetings.noHost);

  await row.getByRole('button', { name: catalogue.meetings.change }).click();
  await row.getByLabel(catalogue.meetings.hostLabel).selectOption({ label: member });
  await row.getByRole('button', { name: catalogue.meetings.save }).click();
  await expect(row).toContainText(fill(catalogue.meetings.host, { email: member }));

  // Moved a day later, it keeps its host.
  const moved = nextDay(first);
  await row.getByRole('button', { name: catalogue.meetings.change }).click();
  await row.getByLabel(catalogue.meetings.dateLabel).fill(moved);
  await row.getByRole('button', { name: catalogue.meetings.save }).click();
  const movedRow = meetingRow(page, language, moved);
  await expect(movedRow).toContainText(fill(catalogue.meetings.host, { email: member }));

  // The scheduled day is free again once the meeting moved off it, so the
  // proposal comes back to it; opening it leaves the week after to propose.
  const second = await prepareFromProposal(page, catalogue);
  expect(second).toBe(first);
  const third = await prepareFromProposal(page, catalogue);
  expect(third > second).toBe(true);
  await expect(meetingRow(page, language, third)).toBeVisible();
}

test('a member prepares and manages a meeting', async ({ page }) => {
  await prepareAMeeting(page, 'en');
});

test('the same flow reads in Polish', async ({ page }) => {
  await prepareAMeeting(page, 'pl');
});
