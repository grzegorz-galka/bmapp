/**
 * The metrics of one project or product, on its own page: each by its bare
 * name, with its latest value and that value's status, a sparkline from its
 * trend, and whether the board shows it. Whoever configures the board adds,
 * edits, shows or hides, thresholds, retires and deletes them here with the
 * settings page's own dialog and threshold form; a metric of a project or
 * product is never derived, so no derivation is offered.
 */
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Metric, MetricCreate, MetricGroup, TrendPoint } from '../../api/metrics';
import type { Member } from '../../api/teams';
import { describeFailure } from '../../i18n/apiErrors';
import { useFormat } from '../../i18n/format';
import {
  ArchiveIcon,
  EditIcon,
  GaugeIcon,
  HistoryIcon,
  PlusIcon,
  RestoreIcon,
  TrashIcon,
} from '../../components/icons';
import { Sparkline } from '../board/Sparkline';
import { describeThreshold, StatusBadge } from '../metrics/display';
import { HiddenSwitch, MetricForm } from '../metrics/MetricForm';
import { BoardThresholdDialog, BoardThresholdHistory } from '../metrics/MetricRow';
import { CreateMetricDialog, type MetricParentWrite } from '../metrics/MetricSettingsPage';
import { useChangeMetric, useDeleteMetric, useTrend } from '../metrics/useMetrics';
import controls from '../../styles/controls.module.css';
import teamStyles from '../teams/teams.module.css';
import meetingStyles from '../meetings/meetings.module.css';
import metricStyles from '../metrics/metrics.module.css';
import styles from './DetailPage.module.css';

/** The latest meeting with a number or a colour set by hand, if any. */
export function latestPoint(points: TrendPoint[]): TrendPoint | undefined {
  return [...points].reverse().find((point) => point.value !== null || point.set_by_hand);
}

export function DetailMetrics({
  teamId,
  parent,
  metrics,
  members,
  groups,
  active,
  mayConfigure,
}: {
  teamId: string;
  parent: MetricParentWrite;
  /** The board's metrics that belong to this project or product. */
  metrics: Metric[];
  members: Member[];
  groups: MetricGroup[];
  /** An inactive one's metrics are retired on the board: only their history is shown. */
  active: boolean;
  mayConfigure: boolean;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);

  return (
    <section aria-labelledby="detail-metrics-heading" className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 id="detail-metrics-heading" className={styles.sectionHeading}>
          {t('projectsAndProducts.detail.metricsHeading')}
        </h2>
        {mayConfigure && (
          <button
            type="button"
            className={controls.default}
            aria-haspopup="dialog"
            onClick={() => setAdding(true)}
          >
            <PlusIcon />
            {t('projectsAndProducts.detail.addMetric')}
          </button>
        )}
      </div>
      {metrics.length === 0 ? (
        <p className={styles.empty}>{t('projectsAndProducts.detail.noMetrics')}</p>
      ) : (
        <ul className={teamStyles.list} aria-labelledby="detail-metrics-heading">
          {metrics.map((metric) => (
            <DetailMetricRow
              key={metric.id}
              teamId={teamId}
              metric={metric}
              members={members}
              active={active}
              mayConfigure={mayConfigure}
            />
          ))}
        </ul>
      )}
      {adding && (
        <CreateMetricDialog
          teamId={teamId}
          members={members}
          groups={groups}
          parent={parent}
          onClose={() => setAdding(false)}
        />
      )}
    </section>
  );
}

type Panel = 'none' | 'edit' | 'threshold' | 'history';

function DetailMetricRow({
  teamId,
  metric,
  members,
  active,
  mayConfigure,
}: {
  teamId: string;
  metric: Metric;
  members: Member[];
  active: boolean;
  mayConfigure: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const trend = useTrend(teamId, metric.id);
  const changeMetric = useChangeMetric(teamId);
  const deleteMetric = useDeleteMetric(teamId);
  const [panel, setPanel] = useState<Panel>('none');
  const [draft, setDraft] = useState<MetricCreate>(() => toDraft(metric));
  // The project's or product's own page: the name alone, never the label.
  const name = metric.name;
  const latest = trend.data ? latestPoint(trend.data.points) : undefined;
  const rowError =
    panel === 'edit' ? undefined : describeFailure(t, changeMetric.error ?? deleteMetric.error);

  function open(next: Panel) {
    changeMetric.reset();
    deleteMetric.reset();
    if (next === 'edit') setDraft(toDraft(metric));
    setPanel(panel === next ? 'none' : next);
  }

  function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    changeMetric.mutate(
      {
        metricId: metric.id,
        change: {
          name: draft.name,
          unit: draft.unit,
          decimals: draft.decimals,
          owner_employee_id: draft.owner_employee_id,
        },
      },
      { onSuccess: () => setPanel('none') },
    );
  }

  const meta = [
    t(`direction.${metric.direction}`),
    metric.unit,
    metric.owner ? t('metrics.owner', { name: metric.owner.display_name }) : null,
    describeThreshold(t, format, metric, metric.threshold),
  ].filter(Boolean);

  return (
    <li className={teamStyles.item}>
      <div className={metricStyles.rowHead}>
        <span className={teamStyles.itemMain}>
          <span className={teamStyles.itemName}>
            {name}
            {metric.hidden && (
              <span className={teamStyles.leaderMark}>
                {t('projectsAndProducts.common.notOnBoard')}
              </span>
            )}
            {active && metric.retired && (
              <span className={teamStyles.leaderMark}>{t('metrics.retired')}</span>
            )}
          </span>
          <span className={teamStyles.itemMeta}>{meta.join(' · ')}</span>
        </span>
        {mayConfigure && active && (
          <span className={metricStyles.rowCorner}>
            <HiddenSwitch
              id={`detail-metric-${metric.id}-hidden`}
              name={name}
              checked={metric.hidden}
              disabled={changeMetric.isPending}
              onChange={(hidden) =>
                changeMetric.mutate({ metricId: metric.id, change: { hidden } })
              }
            />
          </span>
        )}
      </div>
      <div className={styles.reading}>
        {trend.isPending ? (
          <p className={styles.muted}>{t('projectsAndProducts.detail.trendLoading')}</p>
        ) : trend.isError ? (
          <p role="alert">{describeFailure(t, trend.error)}</p>
        ) : (
          <>
            <div
              className={styles.latest}
              aria-label={
                latest
                  ? t('projectsAndProducts.detail.latestOn', {
                      date: format.meetingDate(latest.date),
                    })
                  : t('projectsAndProducts.detail.latest')
              }
              role="group"
            >
              {latest ? (
                <>
                  <span className={styles.latestValue}>
                    {format.metricValue(latest.value, metric.decimals, metric.unit)}
                  </span>
                  <StatusBadge status={latest.status} setByHand={latest.set_by_hand} />
                </>
              ) : (
                <span className={styles.muted}>{t('projectsAndProducts.detail.noValue')}</span>
              )}
            </div>
            <Sparkline name={name} points={trend.data.points} />
          </>
        )}
      </div>
      <div className={metricStyles.rowActions}>
        <span className={metricStyles.actionsStart}>
          <button
            type="button"
            className={controls.button}
            aria-expanded={panel === 'history'}
            aria-label={t('metrics.historyLabel', { name })}
            onClick={() => open('history')}
          >
            <HistoryIcon />
            {t('metrics.history')}
          </button>
          {mayConfigure && (
            <button
              type="button"
              className={controls.button}
              aria-label={t('metrics.editLabel', { name })}
              onClick={() => open('edit')}
            >
              <EditIcon />
              {t('metrics.edit')}
            </button>
          )}
          {mayConfigure && (
            <button
              type="button"
              className={controls.button}
              aria-label={t('metrics.changeThresholdLabel', { name })}
              onClick={() => open('threshold')}
            >
              <GaugeIcon />
              {t('metrics.changeThreshold')}
            </button>
          )}
        </span>
        {mayConfigure && (
          <span className={metricStyles.actionsEnd}>
            {/* While inactive, the project or product retires it; the switch would mean nothing. */}
            {active && (
              <button
                type="button"
                className={`${controls.button} ${metricStyles.steadyWidth}`}
                disabled={changeMetric.isPending}
                aria-label={t(metric.retired ? 'metrics.bringBackLabel' : 'metrics.retireLabel', {
                  name,
                })}
                onClick={() =>
                  changeMetric.mutate({ metricId: metric.id, change: { retired: !metric.retired } })
                }
              >
                {metric.retired ? <RestoreIcon /> : <ArchiveIcon />}
                {metric.retired ? t('metrics.bringBack') : t('metrics.retire')}
              </button>
            )}
            <button
              type="button"
              className={`${controls.button} ${metricStyles.steadyWidth}`}
              disabled={deleteMetric.isPending}
              aria-label={t('metrics.deleteLabel', { name })}
              onClick={() => deleteMetric.mutate(metric.id)}
            >
              <TrashIcon />
              {t('metrics.delete')}
            </button>
          </span>
        )}
      </div>
      {rowError && (
        <p role="alert" className={teamStyles.itemError}>
          {rowError}
        </p>
      )}
      {panel === 'edit' && (
        <div className={meetingStyles.rowForm}>
          {/* No derivation: a project's or product's metric is never derived. */}
          <MetricForm
            idPrefix={`detail-metric-${metric.id}`}
            draft={draft}
            onChange={setDraft}
            onSubmit={handleEdit}
            onCancel={() => setPanel('none')}
            members={members}
            error={changeMetric.error}
            submitLabel={changeMetric.isPending ? t('metrics.saving') : t('metrics.save')}
            pending={changeMetric.isPending}
            directionFixed
          />
        </div>
      )}
      {panel === 'threshold' && (
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
