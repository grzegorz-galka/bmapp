/** Typed client for the team-board API. */
import { request } from './client';

export { ApiError, type ApiFieldError } from './client';

export interface Board {
  id: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
  board: Board;
}

export function listTeams(): Promise<Team[]> {
  return request<Team[]>('/teams');
}

export function createTeam(name: string): Promise<Team> {
  return request<Team>('/teams', { method: 'POST', body: JSON.stringify({ name }) });
}
