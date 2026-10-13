/**
 * What takes a page's place while nobody is signed in.
 *
 * The routes are not rendered at all then, so nothing on them asks the API for
 * anything it would refuse; the page would otherwise sit on its loading text.
 * The address is left alone, so signing in shows the page the person was on.
 */
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthProvider';
import teamStyles from '../teams/teams.module.css';

export function SignedOutPanel() {
  const { t } = useTranslation();
  const { status, signIn } = useAuth();

  return (
    <main className={teamStyles.page}>
      <h1 className={teamStyles.heading}>{t('auth.signedOutTitle')}</h1>
      <p>{t(status === 'ended' ? 'auth.sessionEnded' : 'auth.signedOutBody')}</p>
      <button type="button" className={teamStyles.primary} onClick={() => void signIn()}>
        {t('auth.signIn')}
      </button>
    </main>
  );
}
