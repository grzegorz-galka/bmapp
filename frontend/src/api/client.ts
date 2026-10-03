/**
 * The shared fetch machinery every API client goes through.
 *
 * Requests go to the dev server's /api prefix, which proxies to the backend,
 * so the browser sees one origin and no preflight.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

/**
 * One field-level failure, in the shape every error response uses.
 *
 * `code` names the reason and is what the interface translates. `message` is
 * the API's own English text: developer-facing, never displayed.
 */
export interface ApiFieldError {
  field: string | null;
  code?: string;
  message: string;
}

/** Thrown for any non-2xx response, carrying the field errors the API named. */
export class ApiError extends Error {
  readonly status: number;
  readonly errors: ApiFieldError[];

  constructor(status: number, errors: ApiFieldError[]) {
    super(errors[0]?.message ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }

  /** The failure reported against a given form field, if any. */
  errorFor(field: string): ApiFieldError | undefined {
    return this.errors.find((error) => error.field === field);
  }
}

/**
 * The access token, held here and nowhere that survives the page.
 *
 * A module variable rather than storage: the specification requires that no
 * token be readable after a reload, and `AuthProvider` is the only thing that
 * ever sets it.
 */
let accessToken: string | null = null;

/** What to do when a request comes back 401. Installed by `AuthProvider`. */
let reauthenticate: (() => Promise<string | null>) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setReauthenticate(handler: (() => Promise<string | null>) | null): void {
  reauthenticate = handler;
}

/** Only for tests, which must not leak a session from one case into the next. */
export function resetAuthForTests(): void {
  accessToken = null;
  reauthenticate = null;
}

function headersWith(token: string | null, init?: RequestInit): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers ?? {}),
  };
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: headersWith(accessToken, init),
  });

  if (response.status === 401 && reauthenticate) {
    // A 401 says the session is gone, not that a field was wrong, so it is
    // raised to the auth layer instead of being shown beside a form. Exactly
    // one retry: if the fresh token is refused too, retrying again would
    // loop.
    const renewed = await reauthenticate();
    if (renewed) {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: headersWith(renewed, init),
      });
    }
  }

  if (!response.ok) {
    let errors: ApiFieldError[] = [];
    try {
      const body: unknown = await response.json();
      if (
        body &&
        typeof body === 'object' &&
        Array.isArray((body as { errors?: unknown }).errors)
      ) {
        errors = (body as { errors: ApiFieldError[] }).errors;
      }
    } catch {
      // A response with no JSON body still has to surface as an ApiError.
    }
    throw new ApiError(response.status, errors);
  }

  return (await response.json()) as T;
}
