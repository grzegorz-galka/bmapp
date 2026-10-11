import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type { Metric, MetricCreate } from '../../api/metrics';
import type { Member } from '../../api/teams';
import { describeFailure, isNotFound } from '../../i18n/apiErrors';
import { useFormat } from '../../i18n/format';
import { useAuth } from '../auth/AuthProvider';
import { useIsAdmin } from '../auth/useCurrentUser';
import { useTeam } from '../teams/useTeams';
import { CopyMetricDialog, IncludeGlobalMetricDialog } from './BringMetricDialogs';
import { describeThreshold, GlobalMark } from './display';
import { MetricForm } from './MetricForm';
import { ThresholdDialog, ThresholdHistory } from './thresholds';
import {
  useAddMetric,
  useAddThreshold,
  useChangeMetric,
  useDeleteMetric,
  useMetrics,
  useThresholds,
} from './useMetrics';
import teamStyles from '../teams/teams.module.css';
import meetingStyles from '../meetings/meetings.module.css';

export function MetricSettingsPage() {
  const { teamId = '' } = useParams();
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  const { email: signedInEmail } = useAuth();
  const team = useTeam(teamId);
  const metrics = useMetrics(teamId);

  const back = (
    <Link className={teamStyles.back} to={`/teams/${encodeURIComponent(teamId)}`}>
      {t('metrics.back')}
    </Link>
  );

  if (team.isPending || metrics.isPending) {
    return (
      <main className={teamStyles.page}>
        {back}
        <p>{t('metrics.loading')}</p>
      </main>
    );
  }

  if (team.isError || metrics.isError) {
    return (
      <main className={teamStyles.page}>
        {back}
        {isNotFound(team.error) || isNotFound(metrics.error) ? (
          <h1 className={teamStyles.heading}>{t('metrics.notFound')}</h1>
        ) : (
          <p role="alert">{t('metrics.loadFailed')}</p>
        )}
      </main>
    );
  }

  // As the API decides it: what is measured is the leader's or an
  // administrator's. Everyone else reads the same page without the controls.
  const viewer = team.data.members.find((member) => member.email === signedInEmail);
  const mayConfigure = isAdmin || viewer?.is_leader === true;

  return (
    <main className={teamStyles.page}>
      {back}
      <h1 className={teamStyles.heading}>{t('metrics.heading', { name: team.data.name })}</h1>
      <nav className={`${teamStyles.actions} ${meetingStyles.section}`} aria-label={t('nav.label')}>
        <Link className={teamStyles.button} to={`/teams/${encodeURIComponent(teamId)}`}>
          {t('teams.boardLink')}
        </Link>
        <Link className={teamStyles.button} to={`/teams/${encodeURIComponent(teamId)}/meetings`}>
          {t('board.meetingsLink')}
        </Link>
      </nav>

      {mayConfigure && (
        <>
          <AddMetric teamId={teamId} members={team.data.members} />
          <BringMetric
            teamId={teamId}
            members={team.data.members}
            onBoard={metrics.data.map((metric) => metric.id)}
          />
        </>
      )}

      {metrics.data.length === 0 ? (
        <p>{t('metrics.empty')}</p>
      ) : (
        <ul className={teamStyles.list} aria-label={t('metrics.listLabel')}>
          {metrics.data.map((metric) => (
            <MetricRow
              key={metric.id}
              teamId={teamId}
              metric={metric}
              members={team.data.members}
              mayConfigure={mayConfigure}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

const BLANK_METRIC: MetricCreate = {
  name: '',
  unit: '',
  decimals: 0,
  direction: 'higher_is_better',
  group_label: null,
  position: 0,
  owner_employee_id: null,
};

function AddMetric({ teamId, members }: { teamId: string; members: Member[] }) {
  const { t } = useTranslation();
  const addMetric = useAddMetric(teamId);
  const [draft, setDraft] = useState<MetricCreate>(BLANK_METRIC);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addMetric.mutate(draft, { onSuccess: () => setDraft(BLANK_METRIC) });
  }

  return (
    <MetricForm
      idPrefix="new-metric"
      draft={draft}
      onChange={setDraft}
      onSubmit={handleSubmit}
      members={members}
      error={addMetric.error}
      submitLabel={addMetric.isPending ? t('metrics.adding') : t('metrics.add')}
      pending={addMetric.isPending}
    />
  );
}

type Bringing = 'none' | 'copy' | 'include';

/** The other two ways onto the board: a copy of another board's metric, or a global one. */
function BringMetric({
  teamId,
  members,
  onBoard,
}: {
  teamId: string;
  members: Member[];
  onBoard: string[];
}) {
  const { t } = useTranslation();
  const [bringing, setBringing] = useState<Bringing>('none');
  const close = () => setBringing('none');
  const toggle = (next: Bringing) => setBringing(bringing === next ? 'none' : next);

  return (
    <div className={meetingStyles.section}>
      <span className={teamStyles.actions}>
        <button
          type="button"
          className={teamStyles.button}
          aria-expanded={bringing === 'copy'}
          onClick={() => toggle('copy')}
        >
          {t('metrics.copy')}
        </button>
        <button
          type="button"
          className={teamStyles.button}
          aria-expanded={bringing === 'include'}
          onClick={() => toggle('include')}
        >
          {t('metrics.include')}
        </button>
      </span>
      {bringing === 'copy' && <CopyMetricDialog teamId={teamId} onClose={close} />}
      {bringing === 'include' && (
        <IncludeGlobalMetricDialog
          teamId={teamId}
          members={members}
          onBoard={onBoard}
          onClose={close}
        />
      )}
    </div>
  );
}

type Panel = 'none' | 'edit' | 'threshold' | 'history';

function MetricRow({
  teamId,
  metric,
  members,
  mayConfigure,
}: {
  teamId: string;
  metric: Metric;
  members: Member[];
  mayConfigure: boolean;
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
    const placement = {
      group_label: draft.group_label,
      position: draft.position,
      owner_employee_id: draft.owner_employee_id,
    };
    const change = global
      ? placement
      : { name: draft.name, unit: draft.unit, decimals: draft.decimals, ...placement };
    changeMetric.mutate({ metricId: metric.id, change }, { onSuccess: () => setPanel('none') });
  }

  const meta = [
    t(`direction.${metric.direction}`),
    metric.unit,
    t('metrics.decimals', { count: metric.decimals }),
    metric.group_label ? t('metrics.group', { name: metric.group_label }) : null,
    metric.owner ? t('metrics.owner', { email: metric.owner.email }) : null,
  ].filter(Boolean);
  const rowError =
    panel === 'edit' ? undefined : describeFailure(t, changeMetric.error ?? deleteMetric.error);

  return (
    <li className={teamStyles.item}>
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
        <button
          type="button"
          className={teamStyles.button}
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
              className={teamStyles.button}
              aria-label={t(global ? 'metrics.editPlacementLabel' : 'metrics.editLabel', { name })}
              onClick={() => open('edit')}
            >
              {global ? t('metrics.editPlacement') : t('metrics.edit')}
            </button>
            {!global && (
              <button
                type="button"
                className={teamStyles.button}
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
                className={teamStyles.button}
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
              className={teamStyles.button}
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
    group_label: metric.group_label,
    position: metric.position,
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
