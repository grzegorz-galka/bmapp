/** The identity endpoints. */
import { ApiError, request, type ApiFieldError } from './client';

export interface CurrentUser {
  email: string;
  is_admin: boolean;
  /** The name to show for this person; see team-membership's display name rule. */
  display_name: string;
  /** Made on the server from the display name, so every page agrees on them. */
  initials: string;
}

export function fetchCurrentUser(): Promise<CurrentUser> {
  return request<CurrentUser>('/auth/me');
}

/** A development-mode token, as `/auth/dev-login` and `/auth/dev-password` issue it. */
export interface DevToken {
  access_token: string;
  token_type: string;
}

/**
 * A first sign-in's answer: no token yet, a password to choose first.
 *
 * `name` and `surname` are the proposal to prefill. Both are null only for an
 * administrator with no employee record, who has no name to store.
 */
export interface DevPasswordChangeRequired {
  password_change_required: true;
  name: string | null;
  surname: string | null;
}

export type DevLoginResponse = DevToken | DevPasswordChangeRequired;

export interface DevPasswordChange {
  email: string;
  current_password: string;
  new_password: string;
  name: string | null;
  surname: string | null;
}

export function isPasswordChangeRequired(
  response: DevLoginResponse,
): response is DevPasswordChangeRequired {
  return 'password_change_required' in response;
}

/**
 * POST without the shared client.
 *
 * The shared client answers a 401 by reauthenticating, and reauthenticating
 * comes back to these endpoints - a refusal would loop. Throws the same
 * `ApiError` the client would, so a form translates it like any other.
 */
async function postUnauthenticated<T>(path: string, payload: unknown): Promise<T> {
  const base = import.meta.env.VITE_API_BASE_URL ?? '/api';
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as T & { errors?: ApiFieldError[] };
  if (!response.ok) throw new ApiError(response.status, body.errors ?? []);
  return body;
}

export function devLogin(email: string, password: string): Promise<DevLoginResponse> {
  return postUnauthenticated<DevLoginResponse>('/auth/dev-login', { email, password });
}

export function setDevPassword(change: DevPasswordChange): Promise<DevToken> {
  return postUnauthenticated<DevToken>('/auth/dev-password', change);
}
