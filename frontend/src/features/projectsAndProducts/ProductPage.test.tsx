/**
 * A product's page: the scenario "The Jira link opens the board" of "A
 * project's or product's page" in specs/projects-and-products/spec.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { ProductPage } from './ProductPage';
import { renderWithLanguage } from '../../test/render';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';
import type { Language } from '../../i18n/languages';
import type { Product } from '../../api/products';
import { jsonResponse, MEMBER, TEAM, TEAM_ID } from '../board/boardFixture';

const JIRA = 'https://jira.example.com/secure/RapidBoard.jspa?rapidView=17';

const PRODUCT: Product = {
  id: 'prod-1',
  team_id: TEAM_ID,
  name: 'Customer portal',
  owner: { id: 'emp-jan', email: 'jan@example.com', display_name: 'Jan Kowalski' },
  jira_url: JIRA,
  active: true,
};

const fetchMock = vi.fn();
let product: Product;

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  product = PRODUCT;
  fetchMock.mockImplementation((url: string) => {
    if (url.endsWith('/metric-groups')) return Promise.resolve(jsonResponse([]));
    if (url.endsWith('/metrics')) return Promise.resolve(jsonResponse([]));
    if (url.endsWith(`/products/${PRODUCT.id}`)) return Promise.resolve(jsonResponse(product));
    return Promise.resolve(jsonResponse(TEAM));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderProduct(language: Language = 'en') {
  await renderWithLanguage(
    <Routes>
      <Route path="/teams/:teamId/products/:productId" element={<ProductPage />} />
    </Routes>,
    language,
    { route: `/teams/${TEAM_ID}/products/${PRODUCT.id}`, auth: { email: MEMBER } },
  );
  await screen.findByRole('heading', { name: 'Customer portal', level: 1 });
}

describe("a product's page", () => {
  it('the Jira link opens the board', async () => {
    await renderProduct();

    const link = screen.getByRole('link', {
      name: (name) => name.startsWith(JIRA) && name.endsWith(en.projectsAndProducts.detail.newTab),
    });
    expect(link).toHaveAttribute('href', JIRA);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    expect(screen.getByText(en.projectsAndProducts.detail.noMetrics)).toBeInTheDocument();
  });

  it('says when a product has no Jira board, in Polish too', async () => {
    product = { ...PRODUCT, jira_url: null };
    await renderProduct('pl');

    expect(screen.getByText(pl.projectsAndProducts.detail.noJira)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /jira/i })).not.toBeInTheDocument();
    // The back link falls back to the team's projects and products.
    expect(screen.getByRole('link', { name: pl.back.projectsAndProducts })).toHaveAttribute(
      'href',
      `/teams/${TEAM_ID}/projects-and-products`,
    );
    expect(within(document.body).queryByRole('alert')).not.toBeInTheDocument();
  });
});
