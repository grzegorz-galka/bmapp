/**
 * Signing the end-to-end suite in.
 *
 * Through the backend's development mode, which is what it exists for: the
 * identity broker is not reachable from a developer machine, and a run that
 * stubbed the session would prove nothing about the guards it crosses.
 */
import type { Locator, Page } from '@playwright/test';

/** The administrator the compose stack configures. */
export const ADMIN_EMAIL = 'admin@example.com';

/**
 * The development password for an email: the first two characters of each run
 * of letters and digits, in order.
 *
 * A copy of the backend's rule, which the browser deliberately does not hold.
 * If the two drift, every sign-in in the suite fails at once.
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
 * The login window, found without its wording: a spec may have switched the
 * page to Polish before it appears.
 */
export function loginWindow(page: Page): Locator {
  return page.locator('dialog[aria-labelledby="dev-login-title"]');
}

/** Fill the login window as this person and confirm. */
export async function fillLoginWindow(
  window: Locator,
  email: string,
  password = devPassword(email),
) {
  await window.locator('input[name="email"]').fill(email);
  await window.locator('input[name="password"]').fill(password);
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
 */
export async function signInAs(page: Page, email: string = ADMIN_EMAIL) {
  const previous = installed.get(page);
  if (previous) await page.removeLocatorHandler(previous);

  const window = loginWindow(page);
  installed.set(page, window);
  await page.addLocatorHandler(window, async (dialog) => {
    await fillLoginWindow(dialog, email);
  });
}
