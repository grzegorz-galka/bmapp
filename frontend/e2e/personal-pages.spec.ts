import { expect, test } from '@playwright/test';
import { en } from '../src/i18n/en';
import { organizationToday } from '../src/features/board/organizationDate';
import { ADMIN_EMAIL, signInAs } from './auth';
import { addDays, apiAs, uniqueSuffix } from './api';

/*
 * The pages the navigation names after what a person does: their teams, their
 * meetings and their pulse check, and the way into a team's metric settings
 * under Configuration. A member of two teams, one of which they have already
 * answered the pulse check for, reaches each from the header.
 */

test('a member of two teams reaches their teams, meetings and pulse checks', async ({
  page,
  request,
}) => {
  const suffix = uniqueSuffix();
  const member = `e2e.member.${suffix}@example.com`;
  const leader = `e2e.lead.${suffix}@example.com`;
  const today = organizationToday();
  const admin = await apiAs(request, ADMIN_EMAIL);
  const alpha = await admin.registerTeam(`E2E Alpha ${suffix}`, leader);
  const beta = await admin.registerTeam(`E2E Beta ${suffix}`, leader);
  await admin.addMember(alpha.id, member);
  await admin.addMember(beta.id, member);
  await admin.openMeeting(alpha.id, addDays(today, -7));
  const alphaNext = await admin.openMeeting(alpha.id, addDays(today, 2));
  const betaNext = await admin.openMeeting(beta.id, addDays(today, 4));
  const asMember = await apiAs(request, member);
  await asMember.answerPulse(beta.id, betaNext.id, { rating: 4 });

  await signInAs(page, member);
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: en.nav.label });

  // My teams: both, each with the way to its board, meetings, members and metrics.
  await nav.getByRole('link', { name: en.nav.myTeams }).click();
  await expect(page).toHaveURL(/\/my-teams$/);
  const alphaRow = page.getByRole('listitem').filter({ hasText: `E2E Alpha ${suffix}` });
  await expect(alphaRow.getByRole('link', { name: `Board of E2E Alpha ${suffix}` })).toBeVisible();
  await expect(
    alphaRow.getByRole('link', { name: `Metrics of E2E Alpha ${suffix}` }),
  ).toHaveAttribute('href', `/teams/${alpha.id}/metrics`);
  await expect(page.getByRole('listitem').filter({ hasText: `E2E Beta ${suffix}` })).toBeVisible();

  // My meetings: the coming ones of both teams, soonest first, apart from the past.
  await nav.getByRole('link', { name: en.nav.myMeetings }).click();
  const upcoming = page.getByRole('region', { name: en.meetings.upcomingHeading });
  const upcomingLinks = upcoming.getByRole('link');
  await expect(upcomingLinks.filter({ hasText: suffix })).toHaveCount(2);
  const names = await upcomingLinks.filter({ hasText: suffix }).allTextContents();
  expect(names[0]).toContain(`E2E Alpha ${suffix}`);
  expect(names[1]).toContain(`E2E Beta ${suffix}`);
  await expect(
    page
      .getByRole('region', { name: en.meetings.pastHeading })
      .getByRole('link')
      .filter({ hasText: `E2E Alpha ${suffix}` }),
  ).toHaveCount(1);

  // My pulse check: Alpha not yet answered, Beta answered and changeable.
  await nav.getByRole('link', { name: en.nav.myPulse }).click();
  const alphaPulse = page.getByRole('region', { name: `E2E Alpha ${suffix}` });
  const betaPulse = page.getByRole('region', { name: `E2E Beta ${suffix}` });
  await expect(betaPulse.getByRole('link', { name: /^Change the answer/ })).toBeVisible();
  // Both the meeting held last week and the coming one take answers; the
  // coming one leads to the board's answer form for it.
  const answer = alphaPulse.locator(`a[href*="meeting=${alphaNext.id}"]`);
  await expect(answer).toHaveText(en.personal.answer);
  await answer.click();
  await expect(page).toHaveURL(
    new RegExp(`/teams/${alpha.id}\\?meeting=${alphaNext.id}&view=pulse&mode=answer`),
  );

  // Team metrics, under Configuration: the member's own teams first.
  await nav.getByRole('button', { name: en.nav.configuration }).click();
  await nav.getByRole('link', { name: en.nav.teamMetrics }).click();
  await expect(page).toHaveURL(/\/team-metrics$/);
  await page.getByRole('link', { name: `E2E Alpha ${suffix}` }).click();
  await expect(page).toHaveURL(new RegExp(`/teams/${alpha.id}/metrics$`));
});
