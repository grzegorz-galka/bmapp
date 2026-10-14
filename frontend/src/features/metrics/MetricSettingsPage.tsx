import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import type { MetricCreate, MetricGroup } from '../../api/metrics';
import type { Member } from '../../api/teams';
import { isNotFound } from '../../i18n/apiErrors';
import { useAuth } from '../auth/AuthProvider';
import { useIsAdmin } from '../auth/useCurrentUser';
import { teamAuthority } from '../teams/teamAuthority';
import { useTeam } from '../teams/useTeams';
import { ArrangedMetrics, GroupNameDialog } from './ArrangedMetrics';
import { CopyMetricDialog, IncludeGlobalMetricDialog } from './BringMetricDialogs';
import { MetricForm } from './MetricForm';
import { Modal } from '../../components/Modal';
import { BackLink } from '../../components/BackLink';
import { useAddMetric, useMetricGroups, useMetrics } from './useMetrics';
import controls from '../../styles/controls.module.css';
import teamStyles from '../teams/teams.module.css';
import meetingStyles from '../meetings/meetings.module.css';
import styles from './metrics.module.css';

export function MetricSettingsPage() {
  const { teamId = '' } = useParams();
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  const { email: signedInEmail } = useAuth();
  const team = useTeam(teamId);
  const metrics = useMetrics(teamId);
  const groups = useMetricGroups(teamId);

  const back = (
    <BackLink
      className={teamStyles.back}
      fallback={{ to: `/teams/${encodeURIComponent(teamId)}`, label: t('metrics.back') }}
    />
  );

  if (team.isPending || metrics.isPending || groups.isPending) {
    return (
      <main className={teamStyles.page}>
        {back}
        <p>{t('metrics.loading')}</p>
      </main>
    );
  }

  if (team.isError || metrics.isError || groups.isError) {
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

  // As the API decides it: what is measured is the leader's, a deputy's or
  // an administrator's. Everyone else reads the same page without the controls.
  const mayConfigure = teamAuthority(team.data, signedInEmail, isAdmin).configure;

  return (
    <main className={teamStyles.page}>
      {back}
      <h1 className={teamStyles.heading}>{t('metrics.heading', { name: team.data.name })}</h1>
      {mayConfigure && (
        <AddMetric
          teamId={teamId}
          members={team.data.members}
          groups={groups.data}
          onBoard={metrics.data.map((metric) => metric.id)}
        />
      )}

      {metrics.data.length === 0 && <p>{t('metrics.empty')}</p>}
      <ArrangedMetrics
        teamId={teamId}
        metrics={metrics.data}
        groups={groups.data}
        members={team.data.members}
        mayConfigure={mayConfigure}
      />
    </main>
  );
}

const BLANK_METRIC: MetricCreate = {
  name: '',
  unit: '',
  decimals: 0,
  direction: 'higher_is_better',
  group_id: null,
  owner_employee_id: null,
};

type Adding = 'none' | 'create' | 'copy' | 'include' | 'group';

/**
 * The three ways onto the board, side by side above the list: typed in, copied
 * from another board, or included from the global catalogue, and beside them
 * a new group to arrange them in. Each opens its form in a dialog, so the page
 * itself stays the board's arrangement of what is measured.
 */
function AddMetric({
  teamId,
  members,
  groups,
  onBoard,
}: {
  teamId: string;
  members: Member[];
  groups: MetricGroup[];
  onBoard: string[];
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState<Adding>('none');
  const close = () => setAdding('none');
  const opener = (what: Adding, caption: string) => (
    <button
      type="button"
      className={what === 'create' ? controls.default : controls.button}
      aria-haspopup="dialog"
      onClick={() => setAdding(what)}
    >
      {caption}
    </button>
  );

  return (
    <>
      <div className={styles.addRow}>
        {opener('create', t('metrics.create'))}
        {opener('copy', t('metrics.copy'))}
        {opener('include', t('metrics.include'))}
        {opener('group', t('metrics.addGroup'))}
      </div>
      {adding === 'create' && (
        <CreateMetricDialog teamId={teamId} members={members} groups={groups} onClose={close} />
      )}
      {adding === 'copy' && <CopyMetricDialog teamId={teamId} groups={groups} onClose={close} />}
      {adding === 'include' && (
        <IncludeGlobalMetricDialog
          teamId={teamId}
          members={members}
          groups={groups}
          onBoard={onBoard}
          onClose={close}
        />
      )}
      {adding === 'group' && <GroupNameDialog teamId={teamId} onClose={close} />}
    </>
  );
}

function CreateMetricDialog({
  teamId,
  members,
  groups,
  onClose,
}: {
  teamId: string;
  members: Member[];
  groups: MetricGroup[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const addMetric = useAddMetric(teamId);
  const [draft, setDraft] = useState<MetricCreate>(BLANK_METRIC);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A rejection keeps the dialog open with what was typed.
    addMetric.mutate(draft, { onSuccess: onClose });
  }

  return (
    <Modal labelledBy="new-metric-heading" onClose={onClose}>
      <section className={styles.dialogBody}>
        <h2
          id="new-metric-heading"
          className={`${meetingStyles.subheading} ${styles.dialogHeading}`}
        >
          {t('metrics.create')}
        </h2>
        <MetricForm
          idPrefix="new-metric"
          draft={draft}
          onChange={setDraft}
          onSubmit={handleSubmit}
          onCancel={onClose}
          members={members}
          groups={groups}
          error={addMetric.error}
          submitLabel={addMetric.isPending ? t('metrics.adding') : t('metrics.add')}
          pending={addMetric.isPending}
        />
      </section>
    </Modal>
  );
}
