/**
 * Typed client for the hub summary.
 *
 * The endpoint is provisional: its figures are placeholder data, and each will
 * be replaced by the real capability - meetings, metrics, problems, tasks - as
 * that capability is built. The types here mirror the API exactly so that when
 * it happens, this file changes and the components do not.
 */
import { request } from './client';
import type { Language } from '../i18n/languages';

/**
 * Authored prose, carried in every language.
 *
 * Both languages travel together so a language change costs no request. For
 * the declarations that is permanent - they are published in both. For an
 * item summary it is not: a real problem summary is free text someone types
 * once, in one language, and the problems capability will send exactly that.
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
  scope_meetings: number;
  stages: FunnelStage[];
}

export interface AssignedItem {
  id: string;
  kind: ItemKind;
  summary: LocalizedText;
  team: string;
  progress: number;
  /** ISO 8601 calendar date. A due date has no time of its own. */
  due_on: string;
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
