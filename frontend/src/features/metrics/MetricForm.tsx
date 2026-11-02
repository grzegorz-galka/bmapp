import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DIRECTIONS, type Direction, type MetricCreate, type MetricGroup } from '../../api/metrics';
import type { Member } from '../../api/teams';
import { describeFieldFailure, describeOtherFailure } from '../../i18n/apiErrors';
import controls from '../../styles/controls.module.css';
import teamStyles from '../teams/teams.module.css';
import meetingStyles from '../meetings/meetings.module.css';
import styles from './metrics.module.css';
import {
  DerivationEditor,
  derivationFields,
  isIncomplete,
  type DerivationDraft,
} from './DerivationEditor';

const DEFINITION_FIELDS = ['name', 'unit', 'decimals', 'direction'] as const;
const PLACEMENT_FIELDS = ['group_id', 'owner_employee_id'] as const;

/**
 * The properties of a metric, with the error the API reported against each.
 *
 * A metric has two halves: its definition (name, unit, decimals, direction)
 * and its placement on a board (group, owner). A board's own metric edits
 * both; a global metric is defined in the catalogue without a placement and
 * placed on a board without touching its definition, so either half can be
 * left out. The caller owns the request and decides what to send.
 *
 * The group is chosen only where a metric arrives on the board, by passing
 * `groups`; afterwards it moves between groups on the settings page's layout.
 * Likewise `offerHidden` only where it arrives: afterwards each row has its
 * own switch.
 *
 * `derivation` adds the derivation editor, for a board's own metric only. A
 * source still without its metric stops the submit before anything is sent.
 */
export function MetricForm({
  idPrefix,
  draft,
  onChange,
  onSubmit,
  onCancel,
  members = [],
  error,
  submitLabel,
  pending,
  directionFixed = false,
  definition = true,
  placement = true,
  groups,
  offerHidden = false,
  derivation,
}: {
  idPrefix: string;
  draft: MetricCreate;
  onChange: (draft: MetricCreate) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel?: () => void;
  members?: Member[];
  error: Error | null;
  submitLabel: string;
  pending: boolean;
  directionFixed?: boolean;
  definition?: boolean;
  placement?: boolean;
  groups?: MetricGroup[];
  /** Offer to hide the metric on the board as it arrives there. */
  offerHidden?: boolean;
  derivation?: {
    teamId: string;
    metricId?: string;
    value: DerivationDraft;
    onChange: (draft: DerivationDraft) => void;
  };
}) {
  const { t } = useTranslation();
  const [incomplete, setIncomplete] = useState(false);
  const shown = [
    ...(definition ? DEFINITION_FIELDS : []),
    ...(placement ? PLACEMENT_FIELDS : []),
    ...(derivation ? derivationFields(derivation.value) : []),
  ];
  const fieldError = (field: string) => describeFieldFailure(t, error, field);
  const otherError = describeOtherFailure(t, error, shown);
  const id = (field: string) => `${idPrefix}-${field}`;

  function text(field: 'name' | 'unit') {
    const message = fieldError(field);
    return (
      <div className={teamStyles.field}>
        <label className={teamStyles.label} htmlFor={id(field)}>
          {t(`metrics.${field}Label`)}
        </label>
        <input
          id={id(field)}
          className={teamStyles.input}
          value={draft[field]}
          onChange={(event) => onChange({ ...draft, [field]: event.target.value })}
          aria-invalid={message !== undefined}
        />
        {message && (
          <p role="alert" className={teamStyles.error}>
            {message}
          </p>
        )}
      </div>
    );
  }

  function whole(field: 'decimals', label: string) {
    const message = fieldError(field);
    return (
      <div className={`${teamStyles.field} ${styles.narrow}`}>
        <label className={teamStyles.label} htmlFor={id(field)}>
          {label}
        </label>
        <input
          id={id(field)}
          type="number"
          step={1}
          className={teamStyles.input}
          value={draft[field]}
          onChange={(event) => onChange({ ...draft, [field]: Number(event.target.value) })}
          aria-invalid={message !== undefined}
        />
        {message && (
          <p role="alert" className={teamStyles.error}>
            {message}
          </p>
        )}
      </div>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const stopped = derivation !== undefined && isIncomplete(derivation.value);
    setIncomplete(stopped);
    if (stopped) {
      event.preventDefault();
      return;
    }
    onSubmit(event);
  }

  const directionError = fieldError('direction');
  const ownerError = fieldError('owner_employee_id');

  return (
    <form className={teamStyles.form} onSubmit={handleSubmit} noValidate>
      {definition && (
        <>
          {text('name')}
          {text('unit')}
          {whole('decimals', t('metrics.decimalsLabel'))}
          <div className={teamStyles.field}>
            <label className={teamStyles.label} htmlFor={id('direction')}>
              {t('metrics.directionLabel')}
            </label>
            <select
              id={id('direction')}
              className={meetingStyles.select}
              value={draft.direction}
              disabled={directionFixed}
              aria-describedby={directionFixed ? id('direction-fixed') : undefined}
              onChange={(event) =>
                onChange({ ...draft, direction: event.target.value as Direction })
              }
            >
              {DIRECTIONS.map((direction) => (
                <option key={direction} value={direction}>
                  {t(`direction.${direction}`)}
                </option>
              ))}
            </select>
            {directionFixed && (
              <p id={id('direction-fixed')} className={styles.hint}>
                {t('metrics.directionFixed')}
              </p>
            )}
            {directionError && (
              <p role="alert" className={teamStyles.error}>
                {directionError}
              </p>
            )}
          </div>
        </>
      )}
      {placement && (
        <>
          {groups && (
            <GroupSelect
              id={id('group')}
              value={draft.group_id}
              onChange={(group) => onChange({ ...draft, group_id: group })}
              groups={groups}
              error={fieldError('group_id')}
            />
          )}
          <OwnerSelect
            id={id('owner')}
            value={draft.owner_employee_id}
            onChange={(owner) => onChange({ ...draft, owner_employee_id: owner })}
            members={members}
            error={ownerError}
          />
          {offerHidden && (
            <HiddenSwitch
              id={id('hidden')}
              checked={draft.hidden ?? false}
              onChange={(hidden) => onChange({ ...draft, hidden })}
            />
          )}
        </>
      )}
      {derivation && (
        <DerivationEditor
          idPrefix={idPrefix}
          teamId={derivation.teamId}
          metricId={derivation.metricId}
          value={derivation.value}
          onChange={(next) => {
            setIncomplete(false);
            derivation.onChange(next);
          }}
          error={error}
          incomplete={incomplete}
        />
      )}
      <span className={`${teamStyles.actions} ${teamStyles.submit}`}>
        <button type="submit" className={controls.default} disabled={pending}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className={controls.button} onClick={onCancel}>
            {t('metrics.cancel')}
          </button>
        )}
      </span>
      {otherError && (
        <p role="alert" className={teamStyles.itemError}>
          {otherError}
        </p>
      )}
    </form>
  );
}

/**
 * Whether the board leaves a metric's tile out. A hidden metric is still
 * active: it is recorded, counted and charted. In a dialog it carries a hint
 * saying so; on a metric's row, `name` names the metric in its accessible name.
 */
export function HiddenSwitch({
  id,
  checked,
  onChange,
  name,
  disabled = false,
}: {
  id: string;
  checked: boolean;
  onChange: (hidden: boolean) => void;
  name?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const hint = name === undefined ? `${id}-hint` : undefined;
  return (
    <span className={name === undefined ? styles.switchField : undefined}>
      <label className={styles.check}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-label={name === undefined ? undefined : t('metrics.hiddenLabel', { name })}
          aria-describedby={hint}
          onChange={(event) => onChange(event.target.checked)}
        />
        {t('metrics.hidden')}
      </label>
      {hint && (
        <p id={hint} className={styles.hint}>
          {t('metrics.hiddenHint')}
        </p>
      )}
    </span>
  );
}

/** Who answers for a metric on a board: one of the team, or nobody. */
export function OwnerSelect({
  id,
  value,
  onChange,
  members,
  error,
}: {
  id: string;
  value: string | null;
  onChange: (owner: string | null) => void;
  members: Member[];
  error: string | undefined;
}) {
  const { t } = useTranslation();
  return (
    <div className={teamStyles.field}>
      <label className={teamStyles.label} htmlFor={id}>
        {t('metrics.ownerLabel')}
      </label>
      <select
        id={id}
        className={meetingStyles.select}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">{t('metrics.noOwner')}</option>
        {members.map((member) => (
          <option key={member.employee_id} value={member.employee_id}>
            {member.display_name}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className={teamStyles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Which of the board's groups a metric arrives in, or none: then it is last among the ungrouped. */
export function GroupSelect({
  id,
  value,
  onChange,
  groups,
  error,
}: {
  id: string;
  value: string | null;
  onChange: (group: string | null) => void;
  groups: MetricGroup[];
  error: string | undefined;
}) {
  const { t } = useTranslation();
  return (
    <div className={teamStyles.field}>
      <label className={teamStyles.label} htmlFor={id}>
        {t('metrics.groupLabel')}
      </label>
      <select
        id={id}
        className={meetingStyles.select}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        aria-invalid={error !== undefined}
      >
        <option value="">{t('metrics.noGroupOption')}</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className={teamStyles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
