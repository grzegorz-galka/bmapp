/**
 * Rendering a component under a chosen language.
 *
 * Every component test goes through here rather than reaching into i18next
 * itself, so what a test says about language is one argument, not setup.
 */
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../i18n';
import type { Language } from '../i18n/languages';

export async function renderWithLanguage(ui: ReactElement, language: Language) {
  // Set directly, not through changeLanguage: a test chooses the starting
  // language, which is not the same as a user making an explicit choice that
  // should be remembered.
  await i18n.changeLanguage(language);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </I18nextProvider>,
  );
}
