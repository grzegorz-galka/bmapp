import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { AssignedItem, DashboardTeam, Funnel } from '../../api/dashboard';
import { useFormat } from '../../i18n/format';
import { ArchiveIcon, FunnelIcon, ProblemIcon, TaskIcon } from '../../components/icons';
import { useHere } from '../../components/origin';
import controls from '../../styles/controls.module.css';
import { PdcaBall } from '../board/items/PdcaBall';
import styles from './ItemsTile.module.css';

const STAGE_CLASS = {
  open: styles.open,
  in_progress: styles.inProgress,
  archived: styles.archived,
} as const;

/** The board's list an item of this kind lives in. */
const LIST_FRAGMENT = { problem: 'problems', task: 'tasks' } as const;

const boardPath = (teamId: string) => `/teams/${encodeURIComponent(teamId)}`;

/**
 * "My teams' problems and tasks": where the items of the viewer's teams
 * stand, the way to each team's lists, and what is the viewer's own to do.
 */
export function ItemsTile({
  funnel,
  teams,
  items,
  email,
}: {
  funnel: Funnel;
  teams: DashboardTeam[];
  items: AssignedItem[];
  email: string;
}) {
  const { t } = useTranslation();

  return (
    <section className={styles.tile} aria-labelledby="items-tile-heading">
      <div className={styles.head}>
        <h2 id="items-tile-heading" className={styles.heading}>
          <FunnelIcon />
          {t('itemsTile.heading')}
        </h2>
        <span className={styles.scope}>{t('itemsTile.scope', { count: funnel.scope_teams })}</span>
      </div>

      <FunnelStages funnel={funnel} />

      {teams.length > 0 && <TeamLinks teams={teams} />}

      <hr className={styles.rule} />

      <AssignedItems items={items} email={email} />
    </section>
  );
}

/**
 * The stage total is summed here rather than sent: three numbers that must
 * agree are better derived than transmitted.
 */
function FunnelStages({ funnel }: { funnel: Funnel }) {
  const { t } = useTranslation();
  const format = useFormat();

  return (
    <>
      <ol className={styles.stages}>
        {funnel.stages.map((stage) => (
          <li key={stage.stage} className={[styles.stage, STAGE_CLASS[stage.stage]].join(' ')}>
            <span className={styles.stageName}>{t(`itemsTile.stage_${stage.stage}`)}</span>
            <span className={styles.total}>{format.number(stage.problems + stage.tasks)}</span>
            <span className={styles.split}>
              {t('itemsTile.split', { problems: stage.problems, tasks: stage.tasks })}
            </span>
          </li>
        ))}
      </ol>

      <div className={styles.foot}>
        <span>{t('itemsTile.footLeft')}</span>
        <span>{t('itemsTile.footRight')}</span>
      </div>
    </>
  );
}

/** Each team's problems and tasks lists on its board, and its archive. */
function TeamLinks({ teams }: { teams: DashboardTeam[] }) {
  const { t } = useTranslation();
  const here = useHere('dashboard');

  return (
    <section aria-labelledby="team-lists-heading" className={styles.teamLinks}>
      <h3 id="team-lists-heading" className={styles.subheading}>
        {t('itemsTile.teamLinksHeading')}
      </h3>
      <ul className={styles.teamList}>
        {teams.map((team) => (
          <li key={team.id} className={styles.teamRow}>
            <span className={styles.teamName}>{team.name}</span>
            <span className={styles.links}>
              <Link to={`${boardPath(team.id)}#problems`} state={here} className={controls.link}>
                <ProblemIcon />
                {t('itemsTile.problemsLink')}
              </Link>
              <Link to={`${boardPath(team.id)}#tasks`} state={here} className={controls.link}>
                <TaskIcon />
                {t('itemsTile.tasksLink')}
              </Link>
              <Link
                to={`${boardPath(team.id)}?view=archived`}
                state={here}
                className={controls.link}
              >
                <ArchiveIcon />
                {t('itemsTile.archiveLink')}
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The active problems and tasks assigned to the viewer.
 *
 * Overdue is marked with a word, not only a colour. Whether an item is
 * overdue is the server's call, on the organization's calendar, so the
 * dashboard and the board agree whatever the reader's time zone. The summary
 * is shown as it was typed, whatever the active language, and leads to the
 * list on the board the item is in.
 */
function AssignedItems({ items, email }: { items: AssignedItem[]; email: string }) {
  const { t } = useTranslation();
  const here = useHere('dashboard');
  const format = useFormat();

  return (
    <section aria-labelledby="assigned-heading">
      <div className={styles.head}>
        <h3 id="assigned-heading" className={styles.subheading}>
          {t('itemsTile.assignedHeading')}
        </h3>
        <span className={styles.scope}>{t('itemsTile.assignedTo', { email })}</span>
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>{t('itemsTile.empty')}</p>
      ) : (
        <ul className={styles.items}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <span className={styles.kind}>{t(`items.kind_${item.kind}`)}</span>

              <div className={styles.identity}>
                <Link
                  to={`${boardPath(item.team_id)}#${LIST_FRAGMENT[item.kind]}`}
                  state={here}
                  className={styles.summary}
                >
                  {item.summary}
                </Link>
                <div className={styles.context}>
                  <span>{item.team}</span>
                  {item.metric && <span>{t('items.metric', { name: item.metric.name })}</span>}
                  {item.problem && (
                    <span>{t('items.fromProblem', { summary: item.problem.summary })}</span>
                  )}
                </div>
              </div>

              <span className={styles.itemStage}>
                <PdcaBall stage={item.stage} />
              </span>

              {item.due_on === null ? (
                <span className={styles.due}>{t('items.noDueDate')}</span>
              ) : (
                <span className={item.overdue ? styles.overdue : styles.due}>
                  {t('items.due', { date: format.date(item.due_on) })}
                  {item.overdue && <span className={styles.overdueWord}>{t('items.overdue')}</span>}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
