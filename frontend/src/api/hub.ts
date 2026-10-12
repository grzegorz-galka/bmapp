/**
 * Typed client for the hub summary.
 *
 * The endpoint is provisional: most of its figures are placeholder data, each
 * to be replaced by the real capability as that capability is built. The
 * funnel and the assigned items already are the recorded problems and tasks. The types here mirror the API exactly so that when
 * it happens, this file changes and the components do not.
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
export type ReadinessCode = 'ready' | 'metrics_missing';
export type FunnelStageCode = 'open' | 'in_progress' | 'archived';
export type ItemKind = 'problem' | 'task';

export interface CurrentUser {
  email: string;
  initials: string;
}

export interface Declarations {
  mission: LocalizedText;
  vision: LocalizedText;
  goals: LocalizedText[];
  values: LocalizedText[];
}

export interface BoardReadiness {
  code: ReadinessCode;
  /** How many metric values are still to be recorded. Absent when ready. */
  count: number | null;
}

export interface HubTeam {
  id: string;
  name: string;
  initials: string;
  role: TeamRole;
  /** ISO 8601 instant in UTC, always ahead of when the summary was built. */
  next_meeting_at: string;
  readiness: BoardReadiness;
}

export interface PreparationCounts {
  metrics_due: number;
  problems_to_review: number;
  open_tasks: number;
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
}

export interface HubSummary {
  provisional: true;
  current_user: CurrentUser;
  declarations: Declarations;
  teams: HubTeam[];
  preparation: PreparationCounts;
  meeting_in_session: boolean;
  funnel: Funnel;
  assigned_items: AssignedItem[];
}

/** The text of a localized field in the language being read. */
export function localized(text: LocalizedText, language: Language): string {
  return text[language];
}

export function fetchHubSummary(): Promise<HubSummary> {
  return request<HubSummary>('/hub');
}
