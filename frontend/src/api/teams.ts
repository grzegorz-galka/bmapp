/**
 * Typed client for the team-board and team-membership API.
 *
 * Field names mirror the API's snake_case exactly, as the hub client does, so
 * there is no mapping layer to keep in step with the backend.
 */
import { request } from './client';

export { ApiError, type ApiFieldError } from './client';

export interface Board {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  email: string;
}

export interface Team {
  id: string;
  name: string;
  board: Board;
  leader: Employee;
  member_count: number;
}

export interface Member {
  employee_id: string;
  email: string;
  is_leader: boolean;
}

/** A team with its members, ordered by email. Exactly one is the leader. */
export interface TeamDetail {
  id: string;
  name: string;
  board: Board;
  members: Member[];
}

export interface NewTeam {
  name: string;
  leaderEmail: string;
}

export function listTeams(): Promise<Team[]> {
  return request<Team[]>('/teams');
}

export function createTeam({ name, leaderEmail }: NewTeam): Promise<Team> {
  return request<Team>('/teams', {
    method: 'POST',
    body: JSON.stringify({ name, leader_email: leaderEmail }),
  });
}

export function getTeam(teamId: string): Promise<TeamDetail> {
  return request<TeamDetail>(`/teams/${encodeURIComponent(teamId)}`);
}

export function addMember(teamId: string, email: string): Promise<TeamDetail> {
  return request<TeamDetail>(`/teams/${encodeURIComponent(teamId)}/members`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function removeMember(teamId: string, employeeId: string): Promise<TeamDetail> {
  return request<TeamDetail>(
    `/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(employeeId)}`,
    { method: 'DELETE' },
  );
}

export function makeLeader(teamId: string, employeeId: string): Promise<TeamDetail> {
  return request<TeamDetail>(`/teams/${encodeURIComponent(teamId)}/leader`, {
    method: 'PUT',
    body: JSON.stringify({ employee_id: employeeId }),
  });
}
