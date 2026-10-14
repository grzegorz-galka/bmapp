import { useState, type FormEvent, type HTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { Metric, MetricCreate } from '../../api/metrics';
import type { Member } from '../../api/teams';
import { describeFailure } from '../../i18n/apiErrors';
import { useFormat } from '../../i18n/format';
import { describeThreshold, GlobalMark } from './display';
import { MetricForm } from './MetricForm';
import { ThresholdDialog, ThresholdHistory } from './thresholds';
import { useAddThreshold, useChangeMetric, useDeleteMetric, useThresholds } from './useMetrics';
import controls from '../../styles/controls.module.css';
import teamStyles from '../teams/teams.module.css';
import meetingStyles from '../meetings/meetings.module.css';

type Panel = 'none' | 'edit' | 'threshold' | 'history';

/**
 * One metric on the settings page, with what may be done to it. `arrange`
 * holds the controls that move it in the board's layout, and `rowProps` what
 * makes it draggable; both come from the layout around it.
 */
export function MetricRow({
  teamId,
  metric,
  members,
  mayConfigure,
  arrange,
  rowProps,
}: {
  teamId: string;
  metric: Metric;
  members: Member[];
  mayConfigure: boolean;
  arrange?: ReactNode;
  rowProps?: HTMLAttributes<HTMLLIElement>;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const changeMetric = useChangeMetric(teamId);
  const deleteMetric = useDeleteMetric(teamId);
  const [panel, setPanel] = useState<Panel>('none');
  const [draft, setDraft] = useState<MetricCreate>(() => toDraft(metric));
  const name = metric.name;
  // A global metric's definition and thresholds are the catalogue's: the
  // board places it, retires it here or removes it, and nothing else.
  const global = metric.scope === 'global';

  function open(next: Panel) {
    changeMetric.reset();
    deleteMetric.reset();
    if (next === 'edit') setDraft(toDraft(metric));
    setPanel(panel === next ? 'none' : next);
  }

  function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The direction is never sent: it cannot change, and the form cannot change it.
    // The group changes on the layout, by dragging or the move controls.
    const placement = { owner_employee_id: draft.owner_employee_id };
    const change = global
      ? placement
      : { name: draft.name, unit: draft.unit, decimals: draft.decimals, ...placement };
    changeMetric.mutate({ metricId: metric.id, change }, { onSuccess: () => setPanel('none') });
  }

  const meta = [
    t(`direction.${metric.direction}`),
    metric.unit,
    t('metrics.decimals', { count: metric.decimals }),
    metric.owner ? t('metrics.owner', { email: metric.owner.email }) : null,
  ].filter(Boolean);
  const rowError =
    panel === 'edit' ? undefined : describeFailure(t, changeMetric.error ?? deleteMetric.error);

  return (
    <li {...rowProps} className={`${teamStyles.item} ${rowProps?.className ?? ''}`}>
      <span className={teamStyles.itemMain}>
        <span className={teamStyles.itemName}>
          {name}
          {global && (
            <>
              {' '}
              <GlobalMark />
            </>
          )}
          {metric.retired && <span className={teamStyles.leaderMark}>{t('metrics.retired')}</span>}
        </span>
        <span className={teamStyles.itemMeta}>{meta.join(' · ')}</span>
        <span className={teamStyles.itemMeta}>
          {describeThreshold(t, format, metric, metric.threshold)}
          {metric.threshold &&
            ` · ${t('threshold.effectiveFrom', {
              date: format.meetingDate(metric.threshold.effective_from),
            })}`}
        </span>
        {metric.retired_in_catalogue && (
          <span className={teamStyles.itemMeta}>{t('metrics.retiredInCatalogue')}</span>
        )}
        {global && (
          <span className={teamStyles.itemMeta}>
            {t('metrics.globalNote')} <Link to="/global-metrics">{t('nav.globalMetrics')}</Link>
          </span>
        )}
      </span>
      <span className={teamStyles.actions}>
        {arrange}
        <button
          type="button"
          className={controls.button}
          aria-expanded={panel === 'history'}
          aria-label={t('metrics.historyLabel', { name })}
          onClick={() => open('history')}
        >
          {t('metrics.history')}
        </button>
        {mayConfigure && (
          <>
            <button
              type="button"
              className={controls.button}
              aria-label={t(global ? 'metrics.editPlacementLabel' : 'metrics.editLabel', { name })}
              onClick={() => open('edit')}
            >
              {global ? t('metrics.editPlacement') : t('metrics.edit')}
            </button>
            {!global && (
              <button
                type="button"
                className={controls.button}
                aria-label={t('metrics.changeThresholdLabel', { name })}
                onClick={() => open('threshold')}
              >
                {t('metrics.changeThreshold')}
              </button>
            )}
            {/* The board's switch cannot undo the catalogue's retirement. */}
            {!metric.retired_in_catalogue && (
              <button
                type="button"
                className={controls.button}
                disabled={changeMetric.isPending}
                aria-label={t(metric.retired ? 'metrics.bringBackLabel' : 'metrics.retireLabel', {
                  name,
                })}
                onClick={() =>
                  changeMetric.mutate({ metricId: metric.id, change: { retired: !metric.retired } })
                }
              >
                {metric.retired ? t('metrics.bringBack') : t('metrics.retire')}
              </button>
            )}
            <button
              type="button"
              className={controls.button}
              disabled={deleteMetric.isPending}
              aria-label={t(global ? 'metrics.removeLabel' : 'metrics.deleteLabel', { name })}
              onClick={() => deleteMetric.mutate(metric.id)}
            >
              {global ? t('metrics.remove') : t('metrics.delete')}
            </button>
          </>
        )}
      </span>
      {rowError && (
        <p role="alert" className={teamStyles.itemError}>
          {rowError}
        </p>
      )}
      {panel === 'edit' && (
        <div className={meetingStyles.rowForm}>
          <MetricForm
            idPrefix={`metric-${metric.id}`}
            draft={draft}
            onChange={setDraft}
            onSubmit={handleEdit}
            onCancel={() => setPanel('none')}
            members={members}
            error={changeMetric.error}
            submitLabel={changeMetric.isPending ? t('metrics.saving') : t('metrics.save')}
            pending={changeMetric.isPending}
            directionFixed
            definition={!global}
          />
        </div>
      )}
      {panel === 'threshold' && !global && (
        <BoardThresholdDialog teamId={teamId} metric={metric} onClose={() => setPanel('none')} />
      )}
      {panel === 'history' && <BoardThresholdHistory teamId={teamId} metric={metric} />}
    </li>
  );
}

function toDraft(metric: Metric): MetricCreate {
  return {
    name: metric.name,
    unit: metric.unit,
    decimals: metric.decimals,
    direction: metric.direction,
    group_id: metric.group?.id ?? null,
    owner_employee_id: metric.owner?.id ?? null,
  };
}

/** A threshold version recorded on this board. */
function BoardThresholdDialog({
  teamId,
  metric,
  onClose,
}: {
  teamId: string;
  metric: Metric;
  onClose: () => void;
}) {
  const addThreshold = useAddThreshold(teamId);
  return (
    <ThresholdDialog
      metric={metric}
      onSave={(threshold) =>
        addThreshold.mutate({ metricId: metric.id, threshold }, { onSuccess: onClose })
      }
      onClose={onClose}
      pending={addThreshold.isPending}
      error={addThreshold.error}
    />
  );
}

/** Every version of a metric's threshold, as the board reads it. */
function BoardThresholdHistory({ teamId, metric }: { teamId: string; metric: Metric }) {
  const history = useThresholds(teamId, metric.id);
  return <ThresholdHistory metric={metric} history={history} />;
}
