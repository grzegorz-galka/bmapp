/**
 * Signing the end-to-end suite in.
 *
 * Through the backend's development mode, which is what it exists for: the
 * identity broker is not reachable from a developer machine, and a run that
 * stubbed the session would prove nothing about the guards it crosses.
 *
 * Development mode gives every person their own password after a first
 * sign-in with the derived one. The suite gives everyone it signs in the same
 * one, `E2E_PASSWORD`, so a run never has to remember who it has met: a person
 * met in an earlier run against the same database already has it.
 */
import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

/** The administrator the compose stack configures. */
export const ADMIN_EMAIL = 'admin@example.com';

/** The password the suite chooses for everyone at their first sign-in. */
export const E2E_PASSWORD = 'e2e-password';

/**
 * The development password for an email until one is chosen: the first two
 * characters of each run of letters and digits, in order.
 *
 * A copy of the backend's rule, which the browser deliberately does not hold.
 * If the two drift, every first sign-in in the suite fails at once.
 */
export function devPassword(email: string): string {
  return (
    email
      .trim()
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  )
    .map((run) => run.slice(0, 2))
    .join('');
}

/**
 * The display name of a person with no stored name: the part of the email
 * before the `@`, split on `.` and `_`, each part (and each hyphenated piece)
 * with a capital first letter.
 *
 * A copy of the backend's rule, for asserting on pages that name the people
 * the suite invents. Everyone the suite signs in keeps the proposed name, so
 * this is also what a person who has chosen a password is called.
 */
export function displayName(email: string): string {
  return (email.split('@')[0] ?? email)
    .split(/[._]/)
    .filter(Boolean)
    .map((part) =>
      part
        .split('-')
        .map((piece) => piece.charAt(0).toUpperCase() + piece.slice(1))
        .join('-'),
    )
    .join(' ');
}

interface Token {
  access_token: string;
}

interface ChangeRequired {
  password_change_required: true;
  name: string | null;
  surname: string | null;
}

/**
 * Sign this person in through the API, choosing `E2E_PASSWORD` first if they
 * have not chosen a password yet, and return their token.
 *
 * The derived password is tried first: on a person not met before it asks for
 * a new password, which is set keeping the proposed name; on a person met in an
 * earlier run it is refused, and `E2E_PASSWORD` is what signs them in.
 */
export async function devSignIn(request: APIRequestContext, email: string): Promise<string> {
  const first = await request.post('/api/auth/dev-login', {
    data: { email, password: devPassword(email) },
  });
  if (first.ok()) {
    const body = (await first.json()) as Token | ChangeRequired;
    if (!('password_change_required' in body)) return body.access_token;
    const set = await request.post('/api/auth/dev-password', {
      data: {
        email,
        current_password: devPassword(email),
        new_password: E2E_PASSWORD,
        name: body.name,
        surname: body.surname,
      },
    });
    expect(set.ok(), `setting the password of ${email}: ${await set.text()}`).toBe(true);
    return ((await set.json()) as Token).access_token;
  }

  const again = await request.post('/api/auth/dev-login', {
    data: { email, password: E2E_PASSWORD },
  });
  expect(again.ok(), `signing in ${email}: ${await again.text()}`).toBe(true);
  return ((await again.json()) as Token).access_token;
}

/**
 * The login window, found without its wording: a spec may have switched the
 * page to Polish before it appears.
 */
export function loginWindow(page: Page): Locator {
  return page.locator('dialog[aria-labelledby="dev-login-title"]');
}

/**
 * Fill the login window's first step as this person and confirm.
 *
 * The password defaults to `E2E_PASSWORD`: the caller has made sure, through
 * `devSignIn`, that the person has chosen it.
 */
export async function fillLoginWindow(window: Locator, email: string, password = E2E_PASSWORD) {
  await window.locator('input[name="email"]').fill(email);
  await window.locator('input[name="password"]').fill(password);
  await window.locator('button[type="submit"]').click();
}

/** Fill the login window's second step, choosing a password, and confirm. */
export async function fillNewPassword(window: Locator, password: string, repeated = password) {
  await window.locator('input[name="new_password"]').fill(password);
  await window.locator('input[name="repeat_password"]').fill(repeated);
  await window.locator('button[type="submit"]').click();
}

const installed = new WeakMap<Page, Locator>();

/**
 * Be this person on every page the test opens from now on.
 *
 * A reload or a `page.goto` starts a page with no session, which opens the
 * login window. Rather than every spec signing in after every navigation, a
 * locator handler answers the window whenever it appears, before the next
 * action or assertion. Calling this again replaces who answers.
 *
 * The password is settled through the API once, here, so the handler only
 * ever answers the window's first step.
 */
export async function signInAs(page: Page, email: string = ADMIN_EMAIL) {
  const previous = installed.get(page);
  if (previous) await page.removeLocatorHandler(previous);

  await devSignIn(page.request, email);
  const window = loginWindow(page);
  installed.set(page, window);
  await page.addLocatorHandler(window, async (dialog) => {
    await fillLoginWindow(dialog, email);
  });
}
