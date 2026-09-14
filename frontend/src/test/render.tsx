/**
 * Rendering a component under a chosen language.
 *
 * Every component test goes through here rather than reaching into i18next
 * itself, so what a test says about language is one argument, not setup. The
 * theme and router providers are here for the same reason: a component that
 * reads either should not force every one of its tests to say so.
 */
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import i18n from '../i18n';
import type { Language } from '../i18n/languages';
import { ThemeProvider } from '../theme/ThemeProvider';

interface Options {
  /** The address to start at. Only matters for anything that routes. */
  route?: string;
}

export async function renderWithLanguage(
  ui: ReactElement,
  language: Language,
  { route = '/' }: Options = {},
) {
  // Set directly, not through changeLanguage: a test chooses the starting
  // language, which is not the same as a user making an explicit choice that
  // should be remembered.
  await i18n.changeLanguage(language);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}
