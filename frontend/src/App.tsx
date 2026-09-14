import { LanguageSwitcher } from './components/LanguageSwitcher';
import { TeamsPage } from './features/teams/TeamsPage';

export function App() {
  return (
    <>
      {/* The switcher lives here rather than on each page, so every page has
          it by construction. */}
      <header>
        <LanguageSwitcher />
      </header>
      <TeamsPage />
    </>
  );
}
