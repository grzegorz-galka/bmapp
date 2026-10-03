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
import { ADMIN_EMAIL, signInAs } from './auth';

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

test('the hub loads its summary for the signed-in person', async ({ page }) => {
  await signInAs(page, ADMIN_EMAIL);

  await page.goto('/');

  // The summary arrived, which means the request carried a token the API
  // accepted: without one it would have been refused with 401.
  await expect(page.getByRole('heading', { name: en.hub.heroTitle })).toBeVisible();
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
