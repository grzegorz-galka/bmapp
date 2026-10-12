/**
 * Requirements: a person signs in through the identity broker, and a
 * signed-in person can sign out - through development mode, which issues a
 * token of the same shape and crosses the same guards.
 *
 * Assertions about the identity are scoped to the header: the email also
 * appears in the body, among the items assigned to the person.
 */
import { expect, test, type Page } from '@playwright/test';
import { en } from '../src/i18n/en';
import { apiAs, uniqueSuffix } from './api';
import { ADMIN_EMAIL, devPassword, fillLoginWindow, loginWindow, signInAs } from './auth';

/** The application header, where the identity and the account control live. */
function header(page: Page) {
  return page.getByRole('banner');
}

test('the signed-in person is named in the header, with a way out', async ({ page }) => {
  await signInAs(page, ADMIN_EMAIL);

  await page.goto('/');

  await expect(header(page).getByText(ADMIN_EMAIL, { exact: true })).toBeVisible();
  await expect(header(page).getByRole('button', { name: new RegExp(ADMIN_EMAIL, 'i') })).toHaveText(
    en.auth.signOut,
  );
});

test('the dashboard loads its summary for the signed-in person', async ({ page }) => {
  await signInAs(page, ADMIN_EMAIL);

  await page.goto('/');

  // The summary arrived, which means the request carried a token the API
  // accepted: without one it would have been refused with 401.
  await expect(page.getByRole('heading', { name: en.dashboard.heroTitle })).toBeVisible();
  await expect(header(page).getByText(ADMIN_EMAIL, { exact: true })).toBeVisible();
});

test('signing out leaves no identity and offers the way back in', async ({ page }) => {
  await signInAs(page, ADMIN_EMAIL);
  await page.goto('/');
  await expect(header(page).getByText(ADMIN_EMAIL, { exact: true })).toBeVisible();

  await header(page)
    .getByRole('button', { name: new RegExp(ADMIN_EMAIL, 'i') })
    .click();

  await expect(header(page).getByRole('button', { name: en.auth.signIn })).toBeVisible();
  await expect(header(page).getByText(ADMIN_EMAIL, { exact: true })).toBeHidden();
  // And what was fetched for them is gone with the session, rather than
  // waiting on the page for whoever signs in next.
  await expect(page.getByText(`Assigned to ${ADMIN_EMAIL}`)).toBeHidden();
});

/*
 * Requirement: development mode signs in through a login window. These tests
 * answer the window themselves rather than through `signInAs`, which would
 * answer it for them.
 */

test('the window opens on a page with no session', async ({ page }) => {
  await page.goto('/');

  const window = page.getByRole('dialog', { name: en.auth.devLoginTitle });
  await expect(window).toBeVisible();
  await expect(window.getByLabel(en.auth.devLoginEmail)).toBeVisible();
  await expect(window.getByLabel(en.auth.devLoginPassword)).toHaveValue('');
});

test('signing in through the window shows the person in the header', async ({ page }) => {
  await page.goto('/');

  await fillLoginWindow(loginWindow(page), ADMIN_EMAIL);

  await expect(loginWindow(page)).toBeHidden();
  await expect(header(page).getByText(ADMIN_EMAIL, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: en.dashboard.heroTitle })).toBeVisible();
});

test('a refusal is shown in the window', async ({ page }) => {
  await page.goto('/');
  const window = page.getByRole('dialog', { name: en.auth.devLoginTitle });

  await fillLoginWindow(window, ADMIN_EMAIL, 'wrong');
  await expect(window.getByLabel(en.auth.devLoginPassword)).toHaveAccessibleDescription(
    en.errors['auth.password_incorrect'],
  );

  const stranger = `e2e.stranger.${Date.now()}@example.com`;
  await fillLoginWindow(window, stranger, devPassword(stranger));
  await expect(window.getByLabel(en.auth.devLoginEmail)).toHaveAccessibleDescription(
    en.errors['auth.employee_unknown'],
  );

  await expect(window).toBeVisible();
  await expect(header(page).getByRole('button', { name: en.auth.signIn })).toBeVisible();
});

test('closing the window leaves the person signed out', async ({ page }) => {
  await page.goto('/');
  const window = page.getByRole('dialog', { name: en.auth.devLoginTitle });

  await window.getByRole('button', { name: en.auth.devLoginClose }).click();

  await expect(window).toBeHidden();
  const signIn = header(page).getByRole('button', { name: en.auth.signIn });
  await expect(signIn).toBeVisible();

  await signIn.click();
  await expect(window).toBeVisible();
});

test('a reload asks again, with the email remembered', async ({ page, request }) => {
  // Someone other than the administrator, whose address is also the default
  // the window would show anyway.
  const leader = `e2e.remembered.${uniqueSuffix()}@example.com`;
  const admin = await apiAs(request, ADMIN_EMAIL);
  await admin.registerTeam(`E2E Remembered ${uniqueSuffix()}`, leader);
  await page.goto('/');
  await fillLoginWindow(loginWindow(page), leader);
  await expect(header(page).getByText(leader, { exact: true })).toBeVisible();

  await page.reload();

  const window = page.getByRole('dialog', { name: en.auth.devLoginTitle });
  await expect(window).toBeVisible();
  await expect(window.getByLabel(en.auth.devLoginEmail)).toHaveValue(leader);
  await expect(window.getByLabel(en.auth.devLoginPassword)).toHaveValue('');
});
