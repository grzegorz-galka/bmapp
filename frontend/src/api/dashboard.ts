/**
 * Typed client for the dashboard summary.
 *
 * Everything the dashboard shows arrives in this one response. Apart from the
 * company declarations, which are constants until the targets capability, it
 * is read from recorded data. The types mirror the API's snake_case exactly,
 * as the other clients do.
 */
import { request } from './client';
import type { Stage } from './items';
import type { Language } from '../i18n/languages';

/**
 * Authored prose, carried in every language.
 *
 * Both languages travel together so a language change costs no request. Only
 * the declarations are published in both; an item's summary is free text
 * someone typed once, in one language, and arrives as that one string.
 */
export interface LocalizedText {
  en: string;
  pl: string;
}

export type TeamRole = 'leader' | 'member';
export type FunnelStageCode = 'open' | 'in_progress' | 'archived';
export type ItemKind = 'problem' | 'task';
export type ValueIcon = 'effectiveness' | 'passion' | 'innovation' | 'collaboration';

export interface CurrentUser {
  email: string;
  initials: string;
}

/** A declaration with a headline that carries its emphasis, and a description. */
export interface Statement {
  headline: LocalizedText;
  body: LocalizedText;
}

export interface Value {
  name: LocalizedText;
  description: LocalizedText;
  /** Which pictogram the value is drawn with. */
  icon: ValueIcon;
}

export interface Declarations {
  mission: Statement;
  vision: Statement;
  goals: LocalizedText[];
  values: Value[];
}

/** The weekday (ISO, Monday 1) and start time a team meets, on the organization's clock. */
export interface DashboardSchedule {
  weekday: number;
  start_time: string;
}

export interface DashboardTeam {
  id: string;
  name: string;
  initials: string;
  role: TeamRole;
  schedule: DashboardSchedule | null;
  /**
   * ISO 8601 instant in UTC: the first opened meeting dated today or later,
   * else the date the schedule proposes, else none.
   */
  next_meeting_at: string | null;
}

/** One current or upcoming board meeting of one of the viewer's teams. */
export interface DashboardMeeting {
  team_id: string;
  team: string;
  /** None while the meeting is only proposed by the schedule, not yet opened. */
  meeting_id: string | null;
  /** The meeting's wall-clock date and start time on the organization's clock. */
  date: string;
  start_time: string;
  /** The same moment as an ISO 8601 instant in UTC. */
  starts_at: string;
  /** Decided by the server on the organization's calendar. */
  today: boolean;
  /** The host's email, if one is named. */
  host: string | null;
  /** Active metrics with a value at this meeting, and how many there are. None when proposed. */
  recorded: number | null;
  total: number | null;
  pulse_answered: boolean;
}

export interface FunnelStage {
  stage: FunnelStageCode;
  problems: number;
  tasks: number;
}

export interface Funnel {
  /** How many of the user's teams the figures are counted across. */
  scope_teams: number;
  stages: FunnelStage[];
}

export interface AssignedItem {
  id: string;
  kind: ItemKind;
  /** As it was typed, in whichever language that was. */
  summary: string;
  team_id: string;
  team: string;
  stage: Stage;
  /** ISO 8601 calendar date, or none. A due date has no time of its own. */
  due_on: string | null;
  /** Decided by the server on the organization's calendar, as the board's lists are. */
  overdue: boolean;
  metric: { id: string; name: string } | null;
  /** For a task, the problem it was raised from. */
  problem: { id: string; summary: string } | null;
}

export interface DashboardSummary {
  current_user: CurrentUser;
  declarations: Declarations;
  /** Soonest next meeting first; those with none last, by name. */
  teams: DashboardTeam[];
  /** By start, soonest first. */
  meetings: DashboardMeeting[];
  funnel: Funnel;
  assigned_items: AssignedItem[];
}

/** The text of a localized field in the language being read. */
export function localized(text: LocalizedText, language: Language): string {
  return text[language];
}

export function fetchDashboardSummary(): Promise<DashboardSummary> {
  return request<DashboardSummary>('/dashboard');
}
