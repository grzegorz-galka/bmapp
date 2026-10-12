import { expect, test, type Page } from '@playwright/test';
import { pl } from '../src/i18n/pl';
import { LANGUAGE_STORAGE_KEY } from '../src/i18n/languages';
import { formatDate, formatMeetingDate } from '../src/i18n/format';
import { organizationToday } from '../src/features/board/organizationDate';
import { ADMIN_EMAIL, signInAs } from './auth';
import { addDays, apiAs, uniqueSuffix } from './api';

/*
 * Problems and tasks at the board, in Polish: a member raises a problem with
 * its reason, raises a task from it for themselves that is already overdue,
 * steps the task through the PDCA stages and closes it, which archives it.
 * The Archived view lists it with its meetings, the dashboard stops listing it
 * as assigned and counts it as archived, and a stranger reads the lists with
 * nothing to operate.
 *
 * The meetings are placed around today, since an item is raised and closed at
 * the team's first meeting from today on: last week and in three days (next).
 */

const stageLabel = (stage: keyof typeof pl.pdca, next: keyof typeof pl.pdca) =>
  pl.items.moveStageLabel.replace('{{stage}}', pl.pdca[stage]).replace('{{next}}', pl.pdca[next]);

function lists(page: Page) {
  return page.getByRole('complementary', { name: pl.items.listsLabel });
}

function list(page: Page, heading: string) {
  return lists(page).getByRole('region', { name: heading, exact: true });
}

test('a member keeps a problem and its task to the archive in Polish', async ({
  page,
  request,
}) => {
  const suffix = uniqueSuffix();
  const leader = `e2e.items.lead.${suffix}@example.com`;
  const member = `e2e.items.member.${suffix}@example.com`;
  const stranger = `e2e.items.stranger.${suffix}@example.com`;
  const today = organizationToday();
  const due = addDays(today, -2);
  const problemSummary = `Niestabilne buildy ${suffix}`;
  const taskSummary = `Osobna baza testowa ${suffix}`;

  const admin = await apiAs(request, ADMIN_EMAIL);
  const team = await admin.registerTeam(`E2E Items ${suffix}`, leader);
  await admin.addMember(team.id, member);
  await admin.openMeeting(team.id, addDays(today, -7));
  const next = await admin.openMeeting(team.id, addDays(today, 3));
  // The stranger is recorded, so may sign in, by leading a team of their own.
  await admin.registerTeam(`E2E Items Other ${suffix}`, stranger);

  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key!, value!),
    [LANGUAGE_STORAGE_KEY, 'pl'],
  );
  await signInAs(page, member);
  await page.goto(`/teams/${team.id}`);

  const problems = list(page, pl.items.problemsHeading);
  const tasks = list(page, pl.items.tasksHeading);
  await expect(problems.getByText(pl.items.noProblems)).toBeVisible();
  await expect(tasks.getByText(pl.items.noTasks)).toBeVisible();

  // The member adds a problem with its reason; it appears without a reload.
  await problems.getByRole('button', { name: pl.items.addProblem }).click();
  const newProblem = page.getByRole('dialog', { name: pl.items.newProblemHeading });
  await newProblem.getByLabel(pl.items.summaryLabel).fill(problemSummary);
  await newProblem.getByLabel(pl.items.reasonLabel).fill('Wspólna baza testowa');
  await newProblem.getByRole('button', { name: pl.items.save }).click();
  await expect(newProblem).toBeHidden();
  const problemEntry = problems.getByRole('listitem').filter({ hasText: problemSummary });
  await expect(problemEntry).toContainText(pl.pdca.not_started);
  await expect(problemEntry).toContainText(pl.items.noResponsible);

  // From the problem's dialog, a task for themselves, due two days ago.
  await problems
    .getByRole('button', { name: pl.items.editLabel.replace('{{summary}}', problemSummary) })
    .click();
  const editProblem = page.getByRole('dialog', { name: pl.items.editProblemHeading });
  await expect(editProblem.getByLabel(pl.items.reasonLabel)).toHaveValue('Wspólna baza testowa');
  await editProblem.getByRole('button', { name: pl.items.taskFromProblem }).click();
  const newTask = page.getByRole('dialog', { name: pl.items.newTaskHeading });
  await expect(newTask.getByLabel(pl.items.problemLabel, { exact: true })).toHaveValue(
    /[0-9a-f-]{36}/,
  );
  await newTask.getByLabel(pl.items.summaryLabel).fill(taskSummary);
  await newTask.getByLabel(pl.items.responsibleLabel).selectOption({ label: member });
  await newTask.getByLabel(pl.items.dueLabel).fill(due);
  await newTask.getByRole('button', { name: pl.items.save }).click();
  await expect(newTask).toBeHidden();

  // Overdue in words, new at the meeting shown, and naming its problem.
  const taskEntry = tasks.getByRole('listitem').filter({ hasText: taskSummary });
  await expect(taskEntry).toContainText(member);
  await expect(taskEntry).toContainText(
    pl.items.overdueSince.replace('{{date}}', formatDate(due, 'pl', '')),
  );
  await expect(taskEntry.getByText(pl.items.new, { exact: true })).toBeVisible();
  await expect(taskEntry).toContainText(
    pl.items.fromProblem.replace('{{summary}}', problemSummary),
  );

  // The dashboard lists it as assigned to the member.
  await page.goto('/');
  const assigned = page.getByRole('region', { name: pl.itemsTile.assignedHeading });
  await expect(assigned.getByRole('link', { name: taskSummary })).toBeVisible();
  await expect(assigned).toContainText(pl.items.overdue);

  // Back at the board, the ball steps the task on to `check`.
  await page.goto(`/teams/${team.id}`);
  await taskEntry.getByRole('button', { name: stageLabel('not_started', 'plan') }).click();
  await taskEntry.getByRole('button', { name: stageLabel('plan', 'do') }).click();
  await taskEntry.getByRole('button', { name: stageLabel('do', 'check') }).click();
  await expect(taskEntry.getByRole('button', { name: stageLabel('check', 'act') })).toBeVisible();
  await expect(taskEntry).toContainText(pl.pdca.check);

  // One more step closes it, so the board asks first.
  await taskEntry.getByRole('button', { name: stageLabel('check', 'act') }).click();
  const confirm = page.getByRole('dialog', { name: pl.items.confirmCloseHeading });
  await expect(confirm).toContainText(taskSummary);
  await confirm.getByRole('button', { name: pl.items.confirmClose }).click();
  await expect(confirm).toBeHidden();
  await expect(taskEntry).toBeHidden();
  await expect(tasks.getByText(pl.items.noTasks)).toBeVisible();
  await expect(problemEntry).toBeVisible();
  await expect(
    lists(page).getByText(pl.items.closedAtMeeting.replace('{{count}}', '1')),
  ).toBeVisible();

  // The Archived view lists it, raised and closed at the coming meeting.
  await page
    .getByRole('group', { name: pl.pulse.viewSwitchLabel })
    .getByRole('button', { name: pl.archive.view })
    .click();
  await expect(page).toHaveURL(/[?&]view=archived/);
  const archivedTasks = page.getByRole('region', { name: pl.archive.tasksHeading });
  const row = archivedTasks.getByRole('row').filter({ hasText: taskSummary });
  const meetingDate = formatMeetingDate(addDays(today, 3), 'pl', '');
  await expect(row.getByRole('rowheader')).toHaveText(taskSummary);
  await expect(row.getByRole('cell')).toHaveText([
    member,
    formatDate(due, 'pl', ''),
    meetingDate,
    meetingDate,
  ]);
  await expect(
    page.getByRole('region', { name: pl.archive.problemsHeading }).getByText(pl.archive.noProblems),
  ).toBeVisible();
  // The archive offers no change.
  await expect(archivedTasks.getByRole('button')).toHaveCount(0);

  // The view survives a reload.
  await page.reload();
  await expect(row).toBeVisible();

  // The dashboard no longer lists it, and its funnel counts it as archived.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: pl.itemsTile.heading })).toBeVisible();
  await expect(assigned.getByText(pl.itemsTile.empty)).toBeVisible();
  await expect(assigned.getByRole('link', { name: taskSummary })).toBeHidden();
  const funnel = page.getByRole('region', { name: pl.itemsTile.heading });
  const stage = (name: string) => funnel.getByRole('listitem').filter({ hasText: name });
  await expect(stage(pl.itemsTile.stage_archived)).toContainText(
    pl.itemsTile.split.replace('{{problems}}', '0').replace('{{tasks}}', '1'),
  );
  await expect(stage(pl.itemsTile.stage_open)).toContainText(
    pl.itemsTile.split.replace('{{problems}}', '1').replace('{{tasks}}', '0'),
  );

  // A stranger reads the lists and the archive, with nothing to operate.
  await signInAs(page, stranger);
  await page.goto(`/teams/${team.id}?meeting=${next.id}`);
  await expect(problemEntry).toContainText(problemSummary);
  await expect(problemEntry).toContainText(pl.pdca.not_started);
  await expect(lists(page).getByRole('button')).toHaveCount(0);
  await page.goto(`/teams/${team.id}?meeting=${next.id}&view=archived`);
  await expect(row).toBeVisible();
  await expect(archivedTasks.getByRole('button')).toHaveCount(0);
});
