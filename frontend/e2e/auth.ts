/**
 * Signing the end-to-end suite in.
 *
 * Through the backend's development mode, which is what it exists for: the
 * identity broker is not reachable from a developer machine, and a run that
 * stubbed the session would prove nothing about the guards it crosses.
 */
import type { Page } from '@playwright/test';
import { DEV_EMAIL_KEY } from '../src/features/auth/devEmail';

/** The administrator the compose stack configures. */
export const ADMIN_EMAIL = 'admin@example.com';

/**
 * Sign in as a given person before the application boots.
 *
 * The email is seeded into storage, which is where the development session
 * reads it from, so a test can be somebody other than the administrator.
 */
export async function signInAs(page: Page, email: string = ADMIN_EMAIL) {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key!, value!);
    },
    [DEV_EMAIL_KEY, email],
  );
}
