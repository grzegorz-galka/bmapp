import { expect, test, type Locator, type Page } from '@playwright/test';
import { en, type Translations } from '../src/i18n/en';
import { pl } from '../src/i18n/pl';
import { formatMeetingDate } from '../src/i18n/format';
import { LANGUAGE_STORAGE_KEY, type Language } from '../src/i18n/languages';
import { organizationToday } from '../src/features/board/organizationDate';
import { ADMIN_EMAIL, signInAs } from './auth';
import { addDays, apiAs, isoWeekday } from './api';

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

/** A meeting's row in the dashboard's tile, apart from the tile's other lists. */
function dashboardRow(page: Page, teamName: string) {
  return page
    .getByRole('region', { name: en.meetingsTile.heading })
    .getByRole('listitem')
    .filter({ hasText: teamName })
    .filter({ has: page.getByRole('button') });
}

/*
 * The host's loop before a meeting: the leader plans the next meeting naming
 * its host, one member answers the pulse check, and the host checks readiness
 * from the dashboard, copies the addresses of whoever still owes data, then
 * hides names to share the screen. The team, its schedule, its metrics and an
 * older meeting are set through the API; what is proven goes through the UI.
 */
test('the host checks readiness and chases who still owes data', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const suffix = uniqueSuffix();
  const name = `E2E Readiness ${suffix}`;
  // Named so that email order is host, leader, other.
  const host = `e2e.ready.host.${suffix}@example.com`;
  const leader = `e2e.ready.lead.${suffix}@example.com`;
  const other = `e2e.ready.other.${suffix}@example.com`;
  const today = organizationToday();
  const coming = addDays(today, 3);
  await seedLanguage(page, 'en');
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });

  const admin = await apiAs(request, ADMIN_EMAIL);
  const team = await admin.registerTeam(name, leader);
  await admin.addMember(team.id, host);
  await admin.addMember(team.id, other);
  const { members } = await admin.team(team.id);
  const idOf = (email: string) => members.find((member) => member.email === email)!.employee_id;
  await admin.setSchedule(team.id, isoWeekday(coming), '13:00');
  // A meeting held last week, to switch to with names hidden.
  await admin.openMeeting(team.id, addDays(today, -7));
  await admin.addMetric(team.id, {
    name: 'Lead time',
    direction: 'higher_is_better',
    owner_employee_id: idOf(other),
  });
  await admin.addMetric(team.id, { name: 'Open bugs', direction: 'lower_is_better' });
  // A responsible member in the item lists, which hiding names covers too.
  await admin.raiseTask(team.id, {
    summary: 'Chase the data',
    responsible_employee_id: idOf(host),
  });

  // 1. The leader plans the next meeting from the proposal and names its host.
  await signInAs(page, leader);
  await page.goto(`/teams/${team.id}/meetings`);
  await page.getByRole('button', { name: en.meetings.prepare }).click();
  const form = prepareForm(page, en);
  await expect(form.getByLabel(en.meetings.dateLabel)).toHaveValue(coming);
  await form.getByLabel(en.meetings.hostLabel).selectOption({ label: host });
  await page.getByRole('button', { name: en.meetings.open }).click();
  await expect(form).toBeHidden();
  await expect(meetingRow(page, 'en', coming)).toContainText(
    fill(en.meetings.host, { email: host }),
  );

  // 2. Another member answers the pulse check from the dashboard.
  await signInAs(page, other);
  await page.goto('/');
  await dashboardRow(page, name).getByRole('button', { name: en.meetingsTile.fillPulse }).click();
  await page.getByRole('radio', { name: `4 – ${en.pulse.rating4}` }).check();
  await page.getByRole('button', { name: en.pulse.save, exact: true }).click();
  await expect(page.getByRole('button', { name: en.pulse.yourAnswer })).toBeVisible();

  // 3. The host sees their meeting marked, with what is left counted, not named.
  await signInAs(page, host);
  await page.goto('/');
  const row = dashboardRow(page, name);
  await expect(row).toContainText(en.meetingsTile.youHost);
  await expect(row).toContainText(
    fill(en.meetingsTile.pulseProgress, { answers: '1', members: '3' }),
  );
  await expect(row).toContainText(fill(en.meetingsTile.owing_other, { count: '3' }));
  await expect(row).not.toContainText('@');
  await row.getByRole('button', { name: en.meetingsTile.checkReadiness }).click();
  await expect(page).toHaveURL(/#readiness$/);

  // 4. The panel, scrolled into view, lists the remaining gaps and who owes them.
  // Check readiness opens the panel expanded, though it is collapsed by default.
  const panel = page.getByRole('group', { name: en.readiness.heading });
  await expect(panel).toBeInViewport();
  await expect(panel).toHaveAttribute('open', '');
  await expect(panel.getByText(fill(en.readiness.owing_other, { count: '3' }))).toBeVisible();
  const missing = panel.getByRole('region', { name: en.readiness.metricsHeading });
  await expect(missing.getByRole('listitem').filter({ hasText: 'Lead time' })).toContainText(other);
  await expect(missing.getByRole('listitem').filter({ hasText: 'Open bugs' })).toContainText(
    en.readiness.noOwner,
  );
  const unanswered = panel.getByRole('region', { name: en.readiness.pulseHeading });
  await expect(unanswered.getByRole('listitem')).toHaveText([host, leader]);

  // 5. The addresses go to the clipboard, each once, in email order.
  await panel.getByRole('button', { name: en.readiness.copy }).click();
  await expect(panel.getByRole('status')).toHaveText(
    fill(en.readiness.copied_other, { count: '3' }),
  );
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(`${host}; ${leader}; ${other}`);

  // 6. With names hidden for screen sharing, no view names anyone.
  const main = page.getByRole('main');
  await expect(main.getByText(host).first()).toBeVisible();
  const hide = page.getByLabel(en.pulse.hideNames);
  await hide.check();
  await expect(main).not.toContainText('@');
  await expect(panel.getByRole('button', { name: en.readiness.copy })).toBeHidden();
  await expect(panel).toContainText(fill(en.readiness.unanswered_other, { count: '2' }));

  const views = page.getByRole('group', { name: en.pulse.viewSwitchLabel });
  await views.getByRole('button', { name: /^Pulse check/ }).click();
  await expect(page.getByRole('region', { name: en.pulse.view, exact: true })).toBeVisible();
  await expect(main).not.toContainText('@');

  // Back on the metrics view the address no longer names the panel, so it is
  // collapsed again until the host opens it.
  await views.getByRole('button', { name: /^Metrics/ }).click();
  await expect(panel).toBeVisible();
  await expect(panel).not.toHaveAttribute('open');
  await panel.getByRole('heading', { name: en.readiness.heading }).click();
  await expect(panel).toHaveAttribute('open', '');
  await expect(panel.getByText(fill(en.readiness.unanswered_other, { count: '2' }))).toBeVisible();
  await expect(main).not.toContainText('@');

  // Last week's meeting: past, so no panel, and still no name.
  await page.getByRole('button', { name: en.board.previousMeeting }).click();
  await expect(page).toHaveURL(/[?&]meeting=/);
  await expect(panel).toBeHidden();
  await expect(page.getByText('Chase the data')).toBeVisible();
  await expect(main).not.toContainText('@');
  await expect(hide).toBeChecked();
});
