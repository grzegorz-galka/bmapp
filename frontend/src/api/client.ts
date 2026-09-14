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

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

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
