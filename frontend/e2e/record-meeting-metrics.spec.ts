import { expect, test } from '@playwright/test';
import { pl } from '../src/i18n/pl';
import { LANGUAGE_STORAGE_KEY } from '../src/i18n/languages';
import { organizationToday } from '../src/features/board/organizationDate';
import { ADMIN_EMAIL, signInAs } from './auth';
import { addDays, apiAs, uniqueSuffix } from './api';

/*
 * Recording at a meeting, in Polish: a member types values in the Polish
 * format, sees each one's colour and its change since the last meeting, and
 * sets a status by hand with a comment. An older meeting is read-only. Along
 * the way, the board's layout: the navigator on one line, the wider problems
 * and tasks column, and the metric detail clear of the sticky header.
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
  await page
    .getByRole('combobox', { name: 'Status: Otwarte błędy' })
    .selectOption({ label: pl.status.red });
  await page.getByRole('textbox', { name: 'Komentarz: Otwarte błędy' }).fill('Krytyczny błąd');
  await page.getByRole('textbox', { name: 'Wartość: Przychód' }).click();
  await expect(
    page.getByText(
      pl.recording.completeness.replace('{{recorded}}', '2').replace('{{total}}', '2'),
    ),
  ).toBeVisible();

  // The recording view is a table: the value fields share one left edge,
  // however long each metric's name and unit.
  await page.setViewportSize({ width: 1280, height: 900 });
  const recording = page.getByRole('table');
  await expect(recording.getByRole('columnheader')).toHaveCount(5);
  const lefts = await Promise.all(
    ['Przychód', 'Otwarte błędy'].map(async (name) => {
      const box = await recording.getByRole('textbox', { name: `Wartość: ${name}` }).boundingBox();
      return box?.x ?? -1;
    }),
  );
  expect(lefts[0]).toBeGreaterThan(0);
  expect(Math.abs(lefts[0]! - lefts[1]!)).toBeLessThan(1);
  // On a phone each metric stacks as a card, and the page does not scroll sideways.
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(recording.getByRole('textbox', { name: 'Wartość: Przychód' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 1280, height: 900 });

  // Back on the board: the colours, the change, and the colour set by hand.
  await page.getByRole('button', { name: pl.board.showTiles }).click();
  const tile = (name: string) =>
    page.getByRole('listitem').filter({ has: page.getByRole('heading', { name }) });
  await expect(tile('Przychód')).toContainText('95,3 %');
  await expect(tile('Przychód')).toContainText(pl.status.green);
  await expect(tile('Przychód')).toContainText('+10,3 % od ostatniego spotkania · lepiej');
  await expect(tile('Otwarte błędy')).toContainText(`${pl.status.red}${pl.status.setByHand}`);
  await expect(tile('Otwarte błędy')).toContainText('Krytyczny błąd');

  // The metrics switch counts what has a number, as the pulse check counts answers.
  await expect(page.getByRole('button', { name: 'Wskaźniki 2/2' })).toBeVisible();

  // The navigator stays on one line, its chooser only as wide as it needs.
  await page.setViewportSize({ width: 1280, height: 900 });
  const navigator = page.getByRole('group', { name: pl.board.navigatorLabel });
  const middles = await navigator.locator(':scope > button, :scope > select').evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return box.top + box.height / 2;
    }),
  );
  expect(middles).toHaveLength(3);
  // On one line: every control centred on the same row, whatever its height.
  expect(Math.max(...middles) - Math.min(...middles)).toBeLessThan(2);

  // A wide window gives the problems and tasks their wider column.
  await page.setViewportSize({ width: 1920, height: 1000 });
  const side = await page
    .locator('[class*="_layout_"]')
    .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').at(-1));
  // 31.2rem, give or take the browser's sub-pixel rounding.
  expect(parseFloat(side ?? '0')).toBeCloseTo(31.2 * 16, 0);
  // The board stays within the shared page width, centred, not stretched.
  const boardWidth = await page
    .locator('[class*="_layout_"]')
    .evaluate((grid) => grid.getBoundingClientRect().width);
  expect(boardWidth).toBeLessThanOrEqual(1420);

  // The detail opens above the sticky header, even scrolled down, and lists
  // the values as a grid dated in ISO.
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.mouse.wheel(0, 400);
  await page.getByRole('button', { name: 'Szczegóły: Przychód' }).click();
  const detail = page.getByRole('dialog', { name: 'Przychód' });
  const heading = detail.getByRole('heading', { name: 'Przychód', level: 2 });
  await expect(heading).toBeVisible();
  const uncovered = await heading.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + 4, box.top + box.height / 2);
    return hit !== null && node.contains(hit);
  });
  expect(uncovered).toBe(true);
  const grid = detail.getByRole('table', { name: pl.detail.valuesHeading });
  await expect(grid.getByRole('row').nth(1)).toContainText(/^\d{4}-\d{2}-\d{2}95,3\s%/);
  await page.keyboard.press('Escape');
  await expect(detail).toBeHidden();

  // An older meeting is frozen: listed, not recorded.
  await page.getByLabel(pl.board.meetingSelectLabel, { exact: true }).selectOption(older.id);
  await expect(page.getByText(pl.board.frozen)).toBeVisible();
  await expect(page.getByRole('button', { name: pl.board.record })).toBeHidden();
  await page.getByRole('button', { name: pl.board.list }).click();
  await expect(page.getByText(pl.recording.readOnly)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Wartość: Przychód' })).toBeHidden();
});
