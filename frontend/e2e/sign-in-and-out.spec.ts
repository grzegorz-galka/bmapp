/**
 * Requirements: a person signs in through the identity broker, and a
 * signed-in person can sign out - through development mode, which issues a
 * token of the same shape and crosses the same guards.
 *
 * Assertions about the identity are scoped to the header. The header names
 * the person by display name; their email is shown only in the account menu.
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { en } from '../src/i18n/en';
import { apiAs, uniqueSuffix } from './api';
import {
  ADMIN_EMAIL,
  E2E_PASSWORD,
  devPassword,
  devSignIn,
  displayName,
  fillLoginWindow,
  fillNewPassword,
  loginWindow,
  signInAs,
} from './auth';

/** The application header, where the identity and the account control live. */
function header(page: Page) {
  return page.getByRole('banner');
}

/** The button that names the signed-in person and opens the account menu. */
function account(page: Page, name: string) {
  return header(page).getByRole('button', {
    name: en.auth.accountLabel.replace('{{name}}', name),
  });
}

/** Sign out through the account menu. */
async function signOut(page: Page, name: string) {
  await account(page, name).click();
  await header(page).getByRole('button', { name: en.auth.signOut }).click();
}

/** The administrator is not an employee: the name comes from the email. */
const ADMIN_NAME = displayName(ADMIN_EMAIL);

test('the signed-in person is named in the header, with a way out', async ({ page }) => {
  await signInAs(page, ADMIN_EMAIL);

  await page.goto('/');

  const trigger = account(page, ADMIN_NAME);
  await expect(trigger).toBeVisible();
  await expect(trigger).toContainText(ADMIN_NAME);
  await expect(header(page).getByText(ADMIN_EMAIL, { exact: true })).toBeHidden();

  await trigger.click();
  await expect(header(page).getByText(ADMIN_EMAIL, { exact: true })).toBeVisible();
  await expect(header(page).getByRole('button', { name: en.auth.signOut })).toBeVisible();
});

test('the dashboard loads its summary for the signed-in person', async ({ page }) => {
  await signInAs(page, ADMIN_EMAIL);

  await page.goto('/');

  // The summary arrived, which means the request carried a token the API
  // accepted: without one it would have been refused with 401.
  await expect(page.getByRole('heading', { name: en.dashboard.heroTitle })).toBeVisible();
  await expect(account(page, ADMIN_NAME)).toBeVisible();
});

test('signing out leaves no identity and offers the way back in', async ({ page, request }) => {
  // Signed in by hand rather than through `signInAs`, whose handler would
  // answer the window that signing out opens before it could be seen.
  const name = `E2E Signed Out ${uniqueSuffix()}`;
  const admin = await apiAs(request, ADMIN_EMAIL);
  const team = await admin.registerTeam(name, `e2e.signedout.${uniqueSuffix()}@example.com`);
  await page.goto(`/teams/${team.id}`);
  await fillLoginWindow(loginWindow(page), ADMIN_EMAIL);
  const board = page.getByRole('heading', { name: `Board of ${name}` });
  await expect(board).toBeVisible();
  await expect(account(page, ADMIN_NAME)).toBeVisible();

  await signOut(page, ADMIN_NAME);

  // The board gives way to the signed-out panel, rather than hanging on its
  // loading text with every request refused; the login window opens over it.
  await expect(board).toBeHidden();
  await expect(page.getByRole('heading', { name: en.auth.signedOutTitle })).toBeVisible();
  await expect(page.getByText(/Loading/)).toHaveCount(0);
  await expect(loginWindow(page)).toBeVisible();
  await expect(account(page, ADMIN_NAME)).toBeHidden();

  // Signing in again shows the page the person was on.
  await fillLoginWindow(loginWindow(page), ADMIN_EMAIL);
  await expect(loginWindow(page)).toBeHidden();
  await expect(board).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/teams/${team.id}$`));
  await expect(account(page, ADMIN_NAME)).toBeVisible();
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

test('the window does not say how the password is derived', async ({ page }) => {
  await page.goto('/');

  const window = page.getByRole('dialog', { name: en.auth.devLoginTitle });
  await expect(window).toBeVisible();
  await expect(window).not.toContainText(/grgapspl|first two characters/i);
});

test('signing in through the window shows the person in the header', async ({ page, request }) => {
  await devSignIn(request, ADMIN_EMAIL);
  await page.goto('/');

  await fillLoginWindow(loginWindow(page), ADMIN_EMAIL);

  await expect(loginWindow(page)).toBeHidden();
  await expect(account(page, ADMIN_NAME)).toBeVisible();
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
  await devSignIn(request, leader);
  await page.goto('/');
  await fillLoginWindow(loginWindow(page), leader);
  await expect(account(page, displayName(leader))).toBeVisible();

  await page.reload();

  const window = page.getByRole('dialog', { name: en.auth.devLoginTitle });
  await expect(window).toBeVisible();
  await expect(window.getByLabel(en.auth.devLoginEmail)).toHaveValue(leader);
  await expect(window.getByLabel(en.auth.devLoginPassword)).toHaveValue('');
});

/*
 * Requirement: the first development sign-in sets a password. A person met
 * for the first time signs in with the password derived from their email, is
 * asked for one of their own with their name and surname proposed, and from
 * then on only the chosen one signs them in.
 */

/** A string of lower-case letters, so a derived surname has no digits in it. */
function letters(length: number): string {
  return Array.from({ length }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26)),
  ).join('');
}

/** A newly invented employee, a team's leader, who has never signed in. */
async function newcomer(request: APIRequestContext) {
  const surname = letters(10);
  const email = `ewa.${surname}@example.com`;
  const teamName = `E2E First Sign-in ${uniqueSuffix()}`;
  const admin = await apiAs(request, ADMIN_EMAIL);
  const team = await admin.registerTeam(teamName, email);
  return { email, surname, team, teamName, admin };
}

test('a first sign-in sets a password, a name and a surname', async ({ page, request }) => {
  const { email, surname, team, teamName, admin } = await newcomer(request);
  const chosen = 'my-own-secret';
  const members = await admin.team(team.id);
  await admin.raiseTask(team.id, {
    summary: `Welcome task ${uniqueSuffix()}`,
    responsible_employee_id: members.members[0]!.employee_id,
  });

  await page.goto('/');
  const window = loginWindow(page);
  await fillLoginWindow(window, email, devPassword(email));

  // The second step: the email fixed, the name proposed from it, a new
  // password asked for twice - and still nothing about how the first was made.
  await expect(window.getByText(en.auth.devPasswordIntro)).toBeVisible();
  await expect(window.getByLabel(en.auth.devLoginEmail)).toHaveValue(email);
  await expect(window.getByLabel(en.auth.devLoginEmail)).not.toBeEditable();
  await expect(window.getByLabel(en.auth.devPasswordName, { exact: true })).toHaveValue('Ewa');
  const surnameField = window.getByLabel(en.auth.devPasswordSurname);
  await expect(surnameField).toHaveValue(surname.charAt(0).toUpperCase() + surname.slice(1));
  await expect(window).not.toContainText(
    new RegExp(`${devPassword(email)}|first two characters`, 'i'),
  );

  // A mismatch is caught in the window.
  await fillNewPassword(window, chosen, `${chosen}x`);
  await expect(window.getByLabel(en.auth.devPasswordRepeat)).toHaveAccessibleDescription(
    en.auth.passwordMismatch,
  );

  // The surname corrected, the password confirmed: signed in, and named.
  await surnameField.fill('Kowalska-Nowak');
  await fillNewPassword(window, chosen);
  await expect(window).toBeHidden();
  await expect(account(page, 'Ewa Kowalska-Nowak')).toBeVisible();

  // The board names the responsible member by the name set in the window.
  await page.goto(`/teams/${team.id}`);
  await fillLoginWindow(loginWindow(page), email, chosen);
  await expect(page.getByRole('heading', { name: `Board of ${teamName}` })).toBeVisible();
  await expect(page.locator('#tasks')).toContainText('Ewa Kowalska-Nowak');

  // Signed out, the derived password no longer signs in; the chosen one does.
  await signOut(page, 'Ewa Kowalska-Nowak');
  await expect(loginWindow(page)).toBeVisible();
  await fillLoginWindow(loginWindow(page), email, devPassword(email));
  await expect(loginWindow(page).getByLabel(en.auth.devLoginPassword)).toHaveAccessibleDescription(
    en.errors['auth.password_incorrect'],
  );
  await fillLoginWindow(loginWindow(page), email, chosen);
  await expect(loginWindow(page)).toBeHidden();
  await expect(account(page, 'Ewa Kowalska-Nowak')).toBeVisible();
});

test('a short new password is refused in the window', async ({ page, request }) => {
  const { email } = await newcomer(request);

  await page.goto('/');
  const window = loginWindow(page);
  await fillLoginWindow(window, email, devPassword(email));
  await fillNewPassword(window, 'short');

  await expect(
    window.getByLabel(en.auth.devPasswordNew, { exact: true }),
  ).toHaveAccessibleDescription(en.errors['dev_password.too_short']);
  await expect(window).toBeVisible();

  // Closing at this step stores nothing: the derived password still leads to it.
  await window.getByRole('button', { name: en.auth.devLoginClose }).click();
  await expect(window).toBeHidden();
  const again = await request.post('/api/auth/dev-login', {
    data: { email, password: devPassword(email) },
  });
  expect(await again.json()).toMatchObject({ password_change_required: true });
  // Left as the suite expects everyone it has met to be.
  await devSignIn(request, email);
  const chosen = await request.post('/api/auth/dev-login', {
    data: { email, password: E2E_PASSWORD },
  });
  expect(chosen.ok()).toBe(true);
});
