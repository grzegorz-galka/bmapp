import { expect, test, type Page } from '@playwright/test';
import { pl } from '../src/i18n/pl';
import { LANGUAGE_STORAGE_KEY } from '../src/i18n/languages';
import { organizationToday } from '../src/features/board/organizationDate';
import { ADMIN_EMAIL, signInAs } from './auth';
import { addDays, apiAs, uniqueSuffix } from './api';

/*
 * The pulse check at a meeting, in Polish: two of a team's three members
 * answer at the coming meeting, one of them through the form and then again
 * to change it. The team sees the results with names, and can hide them for
 * screen sharing; a signed-in stranger sees the cards but not the answers; an
 * older meeting takes no answers.
 *
 * The meetings are placed around today, since the answering window is: two
 * weeks ago (frozen), last week (the latest held) and in three days (next).
 */

const caption = (rating: 1 | 2 | 3 | 4 | 5) =>
  pl.pulse.ratingOption
    .replace('{{rating}}', String(rating))
    .replace('{{word}}', pl.pulse[`rating${rating}`]);

function pulseSwitch(page: Page) {
  return page
    .getByRole('group', { name: pl.pulse.viewSwitchLabel })
    .getByRole('button', { name: /^Pulse check/ });
}

test('members answer the pulse check in Polish and the team reads the results', async ({
  page,
  request,
}) => {
  const suffix = uniqueSuffix();
  const leader = `e2e.pulse.lead.${suffix}@example.com`;
  // Named so that the API's order by email puts the first before the second.
  const first = `e2e.pulse.a.${suffix}@example.com`;
  const second = `e2e.pulse.b.${suffix}@example.com`;
  const stranger = `e2e.pulse.stranger.${suffix}@example.com`;
  const today = organizationToday();

  const admin = await apiAs(request, ADMIN_EMAIL);
  const team = await admin.registerTeam(`E2E Pulse ${suffix}`, leader);
  await admin.addMember(team.id, first);
  await admin.addMember(team.id, second);
  const older = await admin.openMeeting(team.id, addDays(today, -14));
  await admin.openMeeting(team.id, addDays(today, -7));
  const next = await admin.openMeeting(team.id, addDays(today, 3));
  // The stranger is recorded, so may sign in, by leading a team of their own.
  await admin.registerTeam(`E2E Pulse Other ${suffix}`, stranger);

  // The first member answers through the API, as only they may.
  const firstMember = await apiAs(request, first);
  await firstMember.answerPulse(team.id, next.id, { rating: 3, negative: 'Za dużo spotkań' });

  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key!, value!),
    [LANGUAGE_STORAGE_KEY, 'pl'],
  );
  await signInAs(page, second);
  await page.goto(`/teams/${team.id}`);

  // The board opens on the coming meeting; its switch says how many answered.
  await expect(pulseSwitch(page)).toHaveText('Pulse check 1/3');
  await pulseSwitch(page).click();
  await expect(page).toHaveURL(new RegExp(`[?&]view=pulse`));

  // The second member answers through the form...
  await page.getByRole('button', { name: pl.pulse.yourAnswer }).click();
  await page.getByRole('radio', { name: caption(5) }).check();
  await page.getByLabel(pl.pulse.questionPositive).fill('Udane wdrożenie');
  await page.getByRole('button', { name: pl.pulse.save, exact: true }).click();
  await expect(pulseSwitch(page)).toHaveText('Pulse check 2/3');

  // ...and changes it, the form showing what they gave before.
  await page.getByRole('button', { name: pl.pulse.yourAnswer }).click();
  await expect(page.getByText(pl.pulse.hasAnswer)).toBeVisible();
  await expect(page.getByRole('radio', { name: caption(5) })).toBeChecked();
  await expect(page.getByLabel(pl.pulse.questionPositive)).toHaveValue('Udane wdrożenie');
  await page.getByRole('radio', { name: caption(4) }).check();
  await page.getByRole('button', { name: pl.pulse.update }).click();

  // The results: two of three, the average of 3 and 4, the distribution.
  const view = page.getByRole('region', { name: pl.pulse.view });
  await expect(view.getByText('2 z 3', { exact: true })).toBeVisible();
  await expect(view.getByText(pl.pulse.missing.replace('{{names}}', leader))).toBeVisible();
  await expect(
    view.getByRole('img', { name: pl.pulse.gaugeLabel.replace('{{average}}', '3,5') }),
  ).toBeVisible();
  const distribution = view.getByRole('region', { name: pl.pulse.distributionTitle });
  const bar = (rating: 1 | 2 | 3 | 4 | 5) =>
    distribution.getByRole('listitem').filter({ hasText: caption(rating) });
  await expect(bar(5)).toHaveText(`${caption(5)}0`);
  await expect(bar(4)).toHaveText(`${caption(4)}1`);
  await expect(bar(3)).toHaveText(`${caption(3)}1`);
  await expect(bar(2)).toHaveText(`${caption(2)}0`);
  await expect(bar(1)).toHaveText(`${caption(1)}0`);

  // Both answers, by email, the changed one as it now stands.
  // The answers' own table: the trend carries a hidden one of its own.
  const answers = view.getByRole('region', { name: pl.pulse.answersHeading, exact: true });
  const rows = answers.getByRole('table').getByRole('row');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1).getByRole('rowheader')).toHaveText(first);
  await expect(rows.nth(1)).toContainText(caption(3));
  await expect(rows.nth(1)).toContainText('Za dużo spotkań');
  await expect(rows.nth(2).getByRole('rowheader')).toHaveText(second);
  await expect(rows.nth(2)).toContainText(caption(4));
  await expect(rows.nth(2)).toContainText('Udane wdrożenie');

  // Hiding names, for sharing the screen, leaves people numbered in that order.
  await view.getByLabel(pl.pulse.hideNames).check();
  await expect(rows.nth(1).getByRole('rowheader')).toHaveText(
    pl.pulse.person.replace('{{n}}', '1'),
  );
  await expect(rows.nth(2).getByRole('rowheader')).toHaveText(
    pl.pulse.person.replace('{{n}}', '2'),
  );
  await expect(view.getByText(first)).toBeHidden();
  await expect(view.getByText(second)).toBeHidden();
  await expect(view.getByText(pl.pulse.missingCount.replace('{{count}}', '1'))).toBeVisible();

  // An older meeting is frozen: its results are shown, no form is offered.
  await page.goto(`/teams/${team.id}?meeting=${older.id}&view=pulse`);
  await expect(view.getByText(pl.pulse.frozen)).toBeVisible();
  await expect(view.getByText(pl.pulse.empty)).toBeVisible();
  await expect(page.getByRole('button', { name: pl.pulse.yourAnswer })).toBeHidden();
  await expect(page.getByRole('button', { name: pl.pulse.answerFirst })).toBeHidden();

  // A stranger reads the cards, never who answered what.
  await signInAs(page, stranger);
  await page.goto(`/teams/${team.id}?meeting=${next.id}&view=pulse`);
  await expect(view.getByText('2 z 3', { exact: true })).toBeVisible();
  await expect(
    view.getByRole('img', { name: pl.pulse.gaugeLabel.replace('{{average}}', '3,5') }),
  ).toBeVisible();
  await expect(bar(4)).toHaveText(`${caption(4)}1`);
  await expect(view.getByText(pl.pulse.missingCount.replace('{{count}}', '1'))).toBeVisible();
  await expect(answers).toBeHidden();
  await expect(view.getByLabel(pl.pulse.hideNames)).toBeHidden();
  await expect(page.getByRole('button', { name: pl.pulse.yourAnswer })).toBeHidden();
  await expect(view.getByText(first)).toBeHidden();
  await expect(view.getByText(leader)).toBeHidden();
});
