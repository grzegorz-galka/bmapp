/**
 * Typed client for a team's problems and tasks.
 *
 * The two are one lifecycle with two bodies: a problem has a reason and a
 * solution proposal, a task has details and may come from a problem. Both
 * carry a PDCA `stage`; `archived` and `overdue` come from the server, which
 * alone decides them on the organization's clock. A due date is a calendar
 * date ("2026-10-14"); every other time is an ISO 8601 instant in UTC.
 */
import { request } from './client';

/** The PDCA stages, in order. Reaching `act` closes and archives an item. */
export type Stage = 'not_started' | 'plan' | 'do' | 'check' | 'act';
export const STAGES: readonly Stage[] = ['not_started', 'plan', 'do', 'check', 'act'];

/** The stage after `stage`, or none at `act`, which is the last. */
export function nextStage(stage: Stage): Stage | undefined {
  return STAGES[STAGES.indexOf(stage) + 1];
}

export type ItemKind = 'problem' | 'task';
export type ItemState = 'active' | 'archived';

export interface ItemResponsible {
  employee_id: string;
  email: string;
}

export interface ItemMetric {
  id: string;
  name: string;
}

/** A meeting at which an item was raised or closed. */
export interface ItemMeeting {
  id: string;
  date: string;
}

interface ItemRead {
  id: string;
  team_id: string;
  summary: string;
  responsible: ItemResponsible | null;
  due_on: string | null;
  metric: ItemMetric | null;
  stage: Stage;
  archived: boolean;
  overdue: boolean;
  raised_at: string;
  raised_meeting: ItemMeeting | null;
  closed_at: string | null;
  closed_meeting: ItemMeeting | null;
  updated_at: string;
}

export interface ProblemRead extends ItemRead {
  reason: string;
  solution: string;
}

export interface TaskRead extends ItemRead {
  details: string;
  problem: { id: string; summary: string } | null;
}

interface ItemWrite {
  summary: string;
  responsible_employee_id?: string | null;
  due_on?: string | null;
  metric_id?: string | null;
  stage?: Stage;
}

export interface ProblemCreate extends ItemWrite {
  reason?: string;
  solution?: string;
}

export interface TaskCreate extends ItemWrite {
  details?: string;
  problem_id?: string | null;
}

/**
 * A partial change. A key left out is left alone; `null` clears an optional
 * field. Only what changed is sent, so two members changing different fields
 * of one item at once do not overwrite each other.
 */
export type ProblemChange = Partial<ProblemCreate>;
export type TaskChange = Partial<TaskCreate>;

const enc = encodeURIComponent;

function listPath(teamId: string, kind: ItemKind): string {
  return `/teams/${enc(teamId)}/${kind === 'problem' ? 'problems' : 'tasks'}`;
}

export function getProblems(teamId: string, state: ItemState): Promise<ProblemRead[]> {
  return request<ProblemRead[]>(`${listPath(teamId, 'problem')}?state=${state}`);
}

export function getTasks(teamId: string, state: ItemState): Promise<TaskRead[]> {
  return request<TaskRead[]>(`${listPath(teamId, 'task')}?state=${state}`);
}

export function createProblem(teamId: string, body: ProblemCreate): Promise<ProblemRead> {
  return request<ProblemRead>(listPath(teamId, 'problem'), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function changeProblem(
  teamId: string,
  problemId: string,
  change: ProblemChange,
): Promise<ProblemRead> {
  return request<ProblemRead>(`${listPath(teamId, 'problem')}/${enc(problemId)}`, {
    method: 'PATCH',
    body: JSON.stringify(change),
  });
}

export function createTask(teamId: string, body: TaskCreate): Promise<TaskRead> {
  return request<TaskRead>(listPath(teamId, 'task'), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function changeTask(teamId: string, taskId: string, change: TaskChange): Promise<TaskRead> {
  return request<TaskRead>(`${listPath(teamId, 'task')}/${enc(taskId)}`, {
    method: 'PATCH',
    body: JSON.stringify(change),
  });
}
