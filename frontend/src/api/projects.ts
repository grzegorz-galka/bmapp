/**
 * Typed client for a team's projects.
 *
 * A project belongs to one team, whose leader, deputies and administrators
 * change it; anyone signed in reads it. Its status is set by hand: the end
 * date is information only, and `past_end` marks an active project that has
 * run past it.
 */
import { request } from './client';

/** A project's manager or a product's owner: an employee, not necessarily a team member. */
export interface NamedPerson {
  id: string;
  email: string;
  /** How the interface names the person; computed by the server. */
  display_name: string;
}

export interface Project {
  id: string;
  team_id: string;
  /** Unique company-wide, regardless of case, e.g. "PRJ-042". */
  code: string;
  name: string;
  manager: NamedPerson;
  /** ISO dates, "YYYY-MM-DD". */
  start_date: string;
  end_date: string;
  /** While false, the project's metrics are retired on the board. */
  active: boolean;
  /** Active, with an end date before today on the organization's clock. */
  past_end: boolean;
}

export interface ProjectCreate {
  code: string;
  name: string;
  /** Recorded as an employee if new; never made a member of the team. */
  manager_email: string;
  start_date: string;
  end_date: string;
}

/** A partial change: a key left out is left alone. The team never changes. */
export type ProjectChange = Partial<ProjectCreate> & { active?: boolean };

const enc = encodeURIComponent;

function projectsPath(teamId: string): string {
  return `/teams/${enc(teamId)}/projects`;
}

/** The team's projects ordered by code, inactive ones included. */
export function listProjects(teamId: string): Promise<Project[]> {
  return request<Project[]>(projectsPath(teamId));
}

export function getProject(teamId: string, projectId: string): Promise<Project> {
  return request<Project>(`${projectsPath(teamId)}/${enc(projectId)}`);
}

export function createProject(teamId: string, project: ProjectCreate): Promise<Project> {
  return request<Project>(projectsPath(teamId), {
    method: 'POST',
    body: JSON.stringify(project),
  });
}

export function changeProject(
  teamId: string,
  projectId: string,
  change: ProjectChange,
): Promise<Project> {
  return request<Project>(`${projectsPath(teamId)}/${enc(projectId)}`, {
    method: 'PATCH',
    body: JSON.stringify(change),
  });
}

/**
 * Delete a project with its metrics. Refused with `project.has_values` once
 * any of them has a value, and with `metric.derivation_source` while one is a
 * derivation's source: make it inactive instead.
 */
export function deleteProject(teamId: string, projectId: string): Promise<void> {
  return request<void>(`${projectsPath(teamId)}/${enc(projectId)}`, { method: 'DELETE' });
}
