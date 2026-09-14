import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { useHubSummary } from '../features/hub/useHubSummary';
import styles from './AppHeader.module.css';

/**
 * The shell every page renders inside.
 *
 * The identity comes from the hub summary rather than being written in here,
 * and it is plain text: there is no session behind it, so offering a sign-out
 * would be a lie. The query is the same one the hub page uses, so this costs
 * no second request.
 */
export function AppHeader() {
  const { t } = useTranslation();
  const summary = useHubSummary();
  const user = summary.data?.current_user;

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
          {t('nav.hub')}
        </NavLink>
        <NavLink to="/teams" className={linkClass}>
          {t('nav.teams')}
        </NavLink>
        {/* The archive has no page yet. Named so the shape of the application
            is visible, but inert and announced as unavailable. */}
        <span className={styles.navItemDisabled} aria-disabled="true" role="link">
          {t('nav.archive')}
          <span className="visually-hidden"> — {t('nav.notYetAvailable')}</span>
        </span>
      </nav>

      <div className={styles.controls}>
        <LanguageSwitcher />
        <ThemeToggle />
        {user && (
          <p className={styles.identity}>
            <span className={styles.avatar} aria-hidden="true">
              {user.initials}
            </span>
            <span className={styles.email}>{user.email}</span>
          </p>
        )}
      </div>
    </header>
  );
}
