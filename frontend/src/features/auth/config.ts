/**
 * How the application talks to the identity broker.
 *
 * BMAPP is a public client: it holds no client secret, because anything given
 * to a single-page application ships inside the bundle. Authorization Code
 * with PKCE is what replaces the secret.
 */
import { UserManager, WebStorageStateStore, type UserManagerSettings } from 'oidc-client-ts';

/** Where the broker sends the browser back to after authenticating. */
export const CALLBACK_PATH = '/auth/callback';

/**
 * A store that keeps nothing.
 *
 * oidc-client-ts defaults to `sessionStorage`, which would leave the access
 * and refresh tokens readable by any script that reaches the page. The
 * specification requires that no token outlive the page, so the library is
 * given somewhere to put them that is forgotten on reload.
 *
 * It implements the `Storage` interface the library expects, backed by a Map
 * rather than by the browser.
 */
export class InMemoryStorage implements Storage {
  private readonly entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }
}

export function buildSettings(origin: string = window.location.origin): UserManagerSettings {
  const store = new InMemoryStorage();
  return {
    authority: import.meta.env.VITE_OIDC_AUTHORITY ?? '',
    client_id: import.meta.env.VITE_OIDC_CLIENT_ID ?? 'bmapp',
    redirect_uri: `${origin}${CALLBACK_PATH}`,
    post_logout_redirect_uri: origin,
    response_type: 'code',
    scope: import.meta.env.VITE_OIDC_SCOPE ?? 'openid email profile offline_access',
    // Nothing is written anywhere that survives the page: neither the tokens
    // once signed in, nor the PKCE verifier while signing in.
    userStore: new WebStorageStateStore({ store }),
    stateStore: new WebStorageStateStore({ store }),
    // The library renews before expiry rather than after, so a request is
    // never sent with a token that has just died.
    automaticSilentRenew: true,
    accessTokenExpiringNotificationTimeInSeconds: 60,
    // The browser still holds the broker's own session cookie after a reload,
    // so the session can be restored without the person being asked again.
    monitorSession: false,
  };
}

export function createUserManager(): UserManager {
  return new UserManager(buildSettings());
}
