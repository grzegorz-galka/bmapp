import { expect, test } from '@playwright/test';
import { pl } from '../src/i18n/pl';
import { LANGUAGE_STORAGE_KEY } from '../src/i18n/languages';
import { organizationToday } from '../src/features/board/organizationDate';
import { ADMIN_EMAIL, signInAs } from './auth';
import { addDays, apiAs, uniqueSuffix } from './api';

/*
 * Recording at a meeting, in Polish: a member types values in the Polish
 * format, sees each one's colour and its change since the last meeting, and
 * sets a colour by hand with a comment. An older meeting is read-only.
 *
 * The meetings are placed around today, since the editing window is: two
 * weeks ago (frozen), last week (the latest held) and in three days (next).
 */

test('a member records values in Polish and sees them judged', async ({ page, request }) => {
  const suffix = uniqueSuffix();
  const leader = `e2e.lead.${suffix}@example.com`;
  const member = `e2e.member.${suffix}@example.com`;
  const today = organizationToday();

  const admin = await apiAs(request, ADMIN_EMAIL);
  const team = await admin.registerTeam(`E2E Recording ${suffix}`, leader);
  await admin.addMember(team.id, member);
  const older = await admin.openMeeting(team.id, addDays(today, -14));
  const held = await admin.openMeeting(team.id, addDays(today, -7));
  await admin.openMeeting(team.id, addDays(today, 3));
  const revenue = await admin.addMetric(team.id, {
    name: 'Przychód',
    unit: '%',
    decimals: 1,
    direction: 'higher_is_better',
  });
  const bugs = await admin.addMetric(team.id, {
    name: 'Otwarte błędy',
    unit: 'szt.',
    decimals: 0,
    direction: 'lower_is_better',
  });
  const plan = { effective_from: '2026-01-01', reason: 'Plan' };
  await admin.addThreshold(team.id, revenue.id, { ...plan, green: '95', amber: '85' });
  await admin.addThreshold(team.id, bugs.id, { ...plan, green: '5', amber: '10' });
  await admin.recordValue(team.id, held.id, revenue.id, '85');
  await admin.recordValue(team.id, older.id, revenue.id, '80', 'History from the old tool');

  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key!, value!),
    [LANGUAGE_STORAGE_KEY, 'pl'],
  );
  await signInAs(page, member);
  await page.goto(`/teams/${team.id}`);

  // The board opens on the coming meeting; the member records its values.
  await page.getByRole('button', { name: pl.board.record }).click();
  await page.getByRole('textbox', { name: 'Wartość: Przychód' }).fill('95,3');
  await page.getByRole('textbox', { name: 'Komentarz: Przychód' }).click();
  await expect(page.getByText(pl.recording.saved).first()).toBeVisible();
  await page.getByRole('textbox', { name: 'Wartość: Otwarte błędy' }).fill('3');
  await page.getByRole('combobox', { name: 'Kolor: Otwarte błędy' }).selectOption('red');
  await page.getByRole('textbox', { name: 'Komentarz: Otwarte błędy' }).fill('Krytyczny błąd');
  await page.getByRole('textbox', { name: 'Wartość: Przychód' }).click();
  await expect(
    page.getByText(
      pl.recording.completeness.replace('{{recorded}}', '2').replace('{{total}}', '2'),
    ),
  ).toBeVisible();

  // Back on the board: the colours, the change, and the colour set by hand.
  await page.getByRole('button', { name: pl.board.showTiles }).click();
  const tile = (name: string) =>
    page.getByRole('listitem').filter({ has: page.getByRole('heading', { name }) });
  await expect(tile('Przychód')).toContainText('95,3 %');
  await expect(tile('Przychód')).toContainText(pl.status.green);
  await expect(tile('Przychód')).toContainText('+10,3 % od ostatniego spotkania · lepiej');
  await expect(tile('Otwarte błędy')).toContainText(`${pl.status.red}${pl.status.setByHand}`);
  await expect(tile('Otwarte błędy')).toContainText('Krytyczny błąd');

  // An older meeting is frozen: listed, not recorded.
  await page.getByLabel(pl.board.meetingSelectLabel, { exact: true }).selectOption(older.id);
  await expect(page.getByText(pl.board.frozen)).toBeVisible();
  await expect(page.getByRole('button', { name: pl.board.record })).toBeHidden();
  await page.getByRole('button', { name: pl.board.list }).click();
  await expect(page.getByText(pl.recording.readOnly)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Wartość: Przychód' })).toBeHidden();
});
