import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { GlobalMetric } from '../../api/globalMetrics';
import type { MetricCreate } from '../../api/metrics';
import { describeFailure } from '../../i18n/apiErrors';
import { useFormat } from '../../i18n/format';
import { useIsAdmin } from '../auth/useCurrentUser';
import { describeThreshold } from '../metrics/display';
import { MetricForm } from '../metrics/MetricForm';
import { Modal } from '../../components/Modal';
import { ThresholdDialog, ThresholdHistory } from '../metrics/thresholds';
import {
  useAddGlobalMetric,
  useAddGlobalThreshold,
  useChangeGlobalMetric,
  useDeleteGlobalMetric,
  useGlobalMetrics,
  useGlobalThresholds,
} from './useGlobalMetrics';
import controls from '../../styles/controls.module.css';
import teamStyles from '../teams/teams.module.css';
import meetingStyles from '../meetings/meetings.module.css';
import metricStyles from '../metrics/metrics.module.css';

/**
 * The company-wide catalogue of global metrics.
 *
 * Everyone signed in reads it; only an administrator is offered the controls,
 * as the API decides it. The definition and threshold editors are the ones the
 * metric settings use, without the placement half, which belongs to each
 * board that includes the metric.
 */
export function GlobalMetricsPage() {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  const catalogue = useGlobalMetrics();

  return (
    <main className={teamStyles.page}>
      <h1 className={teamStyles.heading}>{t('globalMetrics.heading')}</h1>
      <p className={meetingStyles.section}>{t('globalMetrics.intro')}</p>

      {isAdmin && <AddGlobalMetric />}

      {catalogue.isPending ? (
        <p>{t('globalMetrics.loading')}</p>
      ) : catalogue.isError ? (
        <p role="alert">{t('globalMetrics.loadFailed')}</p>
      ) : catalogue.data.length === 0 ? (
        <p>{t('globalMetrics.empty')}</p>
      ) : (
        <ul className={teamStyles.list} aria-label={t('globalMetrics.listLabel')}>
          {catalogue.data.map((metric) => (
            <GlobalMetricRow key={metric.id} metric={metric} mayDefine={isAdmin} />
          ))}
        </ul>
      )}
    </main>
  );
}

const BLANK: MetricCreate = {
  name: '',
  unit: '',
  decimals: 0,
  direction: 'higher_is_better',
  group_id: null,
  owner_employee_id: null,
};

/**
 * "Add global metric" and the form it opens in a dialog, as "Create new
 * metric" does on a board's settings page, so the page itself stays the
 * catalogue.
 */
function AddGlobalMetric() {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);

  return (
    <>
      <div className={metricStyles.addRow}>
        <button
          type="button"
          className={controls.default}
          aria-haspopup="dialog"
          onClick={() => setAdding(true)}
        >
          {t('globalMetrics.add')}
        </button>
      </div>
      {adding && <AddGlobalMetricDialog onClose={() => setAdding(false)} />}
    </>
  );
}

function AddGlobalMetricDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const add = useAddGlobalMetric();
  const [draft, setDraft] = useState<MetricCreate>(BLANK);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { name, unit, decimals, direction } = draft;
    // A rejection keeps the dialog open with what was typed.
    add.mutate({ name, unit, decimals, direction }, { onSuccess: onClose });
  }

  return (
    <Modal labelledBy="new-global-metric-heading" onClose={onClose}>
      <section className={metricStyles.dialogBody}>
        <h2
          id="new-global-metric-heading"
          className={`${meetingStyles.subheading} ${metricStyles.dialogHeading}`}
        >
          {t('globalMetrics.add')}
        </h2>
        <MetricForm
          idPrefix="new-global-metric"
          draft={draft}
          onChange={setDraft}
          onSubmit={handleSubmit}
          onCancel={onClose}
          error={add.error}
          submitLabel={add.isPending ? t('metrics.adding') : t('metrics.add')}
          pending={add.isPending}
          placement={false}
        />
      </section>
    </Modal>
  );
}

type Panel = 'none' | 'edit' | 'threshold' | 'history';

function GlobalMetricRow({ metric, mayDefine }: { metric: GlobalMetric; mayDefine: boolean }) {
  const { t } = useTranslation();
  const format = useFormat();
  const change = useChangeGlobalMetric();
  const remove = useDeleteGlobalMetric();
  const [panel, setPanel] = useState<Panel>('none');
  const [draft, setDraft] = useState<MetricCreate>(() => toDraft(metric));
  const name = metric.name;

  function open(next: Panel) {
    change.reset();
    remove.reset();
    if (next === 'edit') setDraft(toDraft(metric));
    setPanel(panel === next ? 'none' : next);
  }

  function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The direction is never sent: it cannot change, and the form cannot change it.
    const { name: newName, unit, decimals } = draft;
    change.mutate(
      { metricId: metric.id, change: { name: newName, unit, decimals } },
      { onSuccess: () => setPanel('none') },
    );
  }

  const meta = [
    t(`direction.${metric.direction}`),
    metric.unit,
    t('metrics.decimals', { count: metric.decimals }),
    t('globalMetrics.boards', { count: metric.boards }),
  ].filter(Boolean);
  const rowError = panel === 'edit' ? undefined : describeFailure(t, change.error ?? remove.error);

  return (
    <li className={teamStyles.item}>
      <span className={teamStyles.itemMain}>
        <span className={teamStyles.itemName}>
          {name}
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
      </span>
      <span className={teamStyles.actions}>
        <button
          type="button"
          className={controls.button}
          aria-expanded={panel === 'history'}
          aria-label={t('metrics.historyLabel', { name })}
          onClick={() => open('history')}
        >
          {t('metrics.history')}
        </button>
        {mayDefine && (
          <>
            <button
              type="button"
              className={controls.button}
              aria-label={t('metrics.editLabel', { name })}
              onClick={() => open('edit')}
            >
              {t('metrics.edit')}
            </button>
            <button
              type="button"
              className={controls.button}
              aria-label={t('metrics.changeThresholdLabel', { name })}
              onClick={() => open('threshold')}
            >
              {t('metrics.changeThreshold')}
            </button>
            <button
              type="button"
              className={controls.button}
              disabled={change.isPending}
              aria-label={t(metric.retired ? 'metrics.bringBackLabel' : 'metrics.retireLabel', {
                name,
              })}
              onClick={() =>
                change.mutate({ metricId: metric.id, change: { retired: !metric.retired } })
              }
            >
              {metric.retired ? t('metrics.bringBack') : t('metrics.retire')}
            </button>
            <button
              type="button"
              className={controls.button}
              disabled={remove.isPending}
              aria-label={t('metrics.deleteLabel', { name })}
              onClick={() => remove.mutate(metric.id)}
            >
              {t('metrics.delete')}
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
            idPrefix={`global-metric-${metric.id}`}
            draft={draft}
            onChange={setDraft}
            onSubmit={handleEdit}
            onCancel={() => setPanel('none')}
            error={change.error}
            submitLabel={change.isPending ? t('metrics.saving') : t('metrics.save')}
            pending={change.isPending}
            directionFixed
            placement={false}
          />
        </div>
      )}
      {panel === 'threshold' && (
        <CatalogueThresholdDialog metric={metric} onClose={() => setPanel('none')} />
      )}
      {panel === 'history' && <CatalogueThresholdHistory metric={metric} />}
    </li>
  );
}

function toDraft(metric: GlobalMetric): MetricCreate {
  return {
    ...BLANK,
    name: metric.name,
    unit: metric.unit,
    decimals: metric.decimals,
    direction: metric.direction,
  };
}

/** A threshold version recorded in the catalogue, in force on every including board. */
function CatalogueThresholdDialog({
  metric,
  onClose,
}: {
  metric: GlobalMetric;
  onClose: () => void;
}) {
  const add = useAddGlobalThreshold();
  return (
    <ThresholdDialog
      metric={metric}
      onSave={(threshold) => add.mutate({ metricId: metric.id, threshold }, { onSuccess: onClose })}
      onClose={onClose}
      pending={add.isPending}
      error={add.error}
    />
  );
}

function CatalogueThresholdHistory({ metric }: { metric: GlobalMetric }) {
  const history = useGlobalThresholds(metric.id);
  return <ThresholdHistory metric={metric} history={history} />;
}
