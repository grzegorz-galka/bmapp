/** The identity endpoints. */
import { request } from './client';

export interface CurrentUser {
  email: string;
  is_admin: boolean;
}

export function fetchCurrentUser(): Promise<CurrentUser> {
  return request<CurrentUser>('/auth/me');
}
