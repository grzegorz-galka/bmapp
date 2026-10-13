/**
 * Requirement: a team's pages lead back to where they were opened from.
 * See specs/dashboard/spec.md and add-navigation-context's design.md.
 *
 * The origin travels in the router's location state, which only a real
 * browser history exercises end to end: a view switch on the board is a
 * history entry of its own, and must carry the origin on.
 */
import { expect, test } from '@playwright/test';
import { en } from '../src/i18n/en';
import { organizationToday } from '../src/features/board/organizationDate';
import { ADMIN_EMAIL, signInAs } from './auth';
import { addDays, apiAs, uniqueSuffix } from './api';

test('a board leads back to the screen it was opened from', async ({ page, request }) => {
  const suffix = uniqueSuffix();
  const teamName = `E2E Back ${suffix}`;
  const member = `e2e.back.member.${suffix}@example.com`;
  const admin = await apiAs(request, ADMIN_EMAIL);
  const team = await admin.registerTeam(teamName, `e2e.back.lead.${suffix}@example.com`);
  await admin.addMember(team.id, member);
  await admin.openMeeting(team.id, addDays(organizationToday(), 2));

  await signInAs(page, member);
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: en.nav.label });
  const board = page.getByRole('heading', { name: `Board of ${teamName}` });

  // Opened from My meetings.
  await nav.getByRole('link', { name: en.nav.myMeetings }).click();
  await page
    .getByRole('region', { name: en.meetings.upcomingHeading })
    .getByRole('link')
    .filter({ hasText: teamName })
    .click();
  await expect(board).toBeVisible();

  // The board's own views keep the origin.
  const views = page.getByRole('group', { name: en.pulse.viewSwitchLabel }).getByRole('button');
  await views.nth(1).click();
  await expect(page).toHaveURL(/view=pulse/);
  await views.nth(0).click();
  await expect(page).not.toHaveURL(/view=/);

  await page.getByRole('link', { name: en.back.myMeetings }).click();
  await expect(page).toHaveURL(/\/my-meetings$/);
  await expect(
    page.getByRole('heading', { name: en.personal.meetingsHeading, level: 1 }),
  ).toBeVisible();

  // Opened from the dashboard.
  await nav.getByRole('link', { name: en.nav.dashboard }).click();
  await page
    .getByRole('region', { name: en.itemsTile.teamLinksHeading })
    .getByRole('listitem')
    .filter({ hasText: teamName })
    .getByRole('link', { name: en.itemsTile.archiveLink })
    .click();
  await expect(board).toBeVisible();
  await expect(page.getByRole('link', { name: en.back.dashboard })).toHaveAttribute('href', '/');
});
