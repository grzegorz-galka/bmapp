import { useEffect, useRef, useState } from 'react';
import { NavLink, matchPath, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';
import { AccountControl } from './AccountControl';
import { useDashboardSummary } from '../features/dashboard/useDashboardSummary';
import styles from './AppHeader.module.css';

/** The pages grouped under Configuration, in the order the group lists them. */
const CONFIGURATION = [
  { to: '/teams', label: 'nav.teams' },
  { to: '/team-metrics', label: 'nav.teamMetrics' },
  { to: '/global-metrics', label: 'nav.globalMetrics' },
] as const;

/**
 * The shell every page renders inside.
 *
 * The navigation names what a person does - their teams, their meetings,
 * their pulse check - and groups the pages that set things up under
 * Configuration. That group is a disclosure rather than an ARIA menu: these
 * are links between pages, and a disclosure keeps ordinary Tab navigation.
 *
 * The identity comes from the dashboard summary rather than being written in
 * here. The query is the same one the dashboard uses, so this costs no second
 * request.
 */
export function AppHeader() {
  const { t } = useTranslation();
  const summary = useDashboardSummary();
  const user = summary.data?.current_user;
  const { pathname } = useLocation();
  // Remembered as the address it was opened at, so a change of page - by a
  // choice in the group or by any other means - folds it away by itself.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const configOpen = openedAt === pathname;
  const setConfigOpen = (open: boolean) => setOpenedAt(open ? pathname : null);
  const group = useRef<HTMLDivElement>(null);

  // Exactly these addresses: a team's own pages under /teams/:id belong to
  // that team, not to the register of teams.
  const inConfiguration = CONFIGURATION.some(({ to }) => matchPath(to, pathname));

  useEffect(() => {
    if (!configOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!group.current?.contains(event.target as Node)) setOpenedAt(null);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [configOpen]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    [styles.navItem, isActive ? styles.navItemActive : ''].filter(Boolean).join(' ');

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true" />
        <span className={styles.brandText}>
          <span className={styles.brandName}>{t('app.title')}</span>
          <span className={styles.brandSub}>{t('nav.brandSub')}</span>
        </span>
      </div>

      <nav className={styles.nav} aria-label={t('nav.label')}>
        <NavLink to="/" className={linkClass} end>
          {t('nav.dashboard')}
        </NavLink>
        <NavLink to="/my-teams" className={linkClass}>
          {t('nav.myTeams')}
        </NavLink>
        <NavLink to="/my-meetings" className={linkClass}>
          {t('nav.myMeetings')}
        </NavLink>
        <NavLink to="/my-pulse" className={linkClass}>
          {t('nav.myPulse')}
        </NavLink>
        <div
          ref={group}
          className={styles.group}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && configOpen) {
              setConfigOpen(false);
              group.current?.querySelector('button')?.focus();
            }
          }}
        >
          <button
            type="button"
            className={[
              styles.navItem,
              styles.groupButton,
              inConfiguration ? styles.navItemActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-expanded={configOpen}
            aria-controls="nav-configuration"
            aria-current={inConfiguration ? 'page' : undefined}
            onClick={() => setConfigOpen(!configOpen)}
          >
            {t('nav.configuration')}
            <span className={styles.caret} aria-hidden="true" />
          </button>
          {configOpen && (
            <ul id="nav-configuration" className={styles.groupList}>
              {CONFIGURATION.map(({ to, label }) => (
                <li key={to}>
                  <NavLink to={to} end className={linkClass} onClick={() => setConfigOpen(false)}>
                    {t(label)}
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      </nav>

      <div className={styles.controls}>
        <LanguageToggle />
        <ThemeToggle />
        <AccountControl initials={user?.initials} />
      </div>
    </header>
  );
}
