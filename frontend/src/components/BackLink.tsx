import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useOrigin } from './origin';

/**
 * A team page's way back: to the screen the page was opened from, named after
 * it, or - with no recorded origin, as from a bookmark - to `fallback`.
 */
export function BackLink({
  fallback,
  className,
}: {
  /** Where the link leads, and what it says, when the origin is not known. */
  fallback: { to: string; label: string };
  className?: string;
}) {
  const { t } = useTranslation();
  const origin = useOrigin();

  if (!origin) {
    return (
      <Link className={className} to={fallback.to}>
        {fallback.label}
      </Link>
    );
  }

  return (
    <Link className={className} to={origin.path} state={origin.state}>
      {t(`back.${origin.screen}`)}
    </Link>
  );
}
