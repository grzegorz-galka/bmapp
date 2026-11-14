/**
 * Typed client for a team's products.
 *
 * A product belongs to one team, whose leader, deputies and administrators
 * change it; anyone signed in reads it. Its link to a Jira board is only
 * followed, never read from.
 */
import { request } from './client';
import type { NamedPerson } from './projects';

export interface Product {
  id: string;
  team_id: string;
  /** Unique within the team, regardless of case. */
  name: string;
  owner: NamedPerson;
  /** An absolute http or https address, or none. */
  jira_url: string | null;
  /** While false, the product's metrics are retired on the board. */
  active: boolean;
}

export interface ProductCreate {
  name: string;
  /** Recorded as an employee if new; never made a member of the team. */
  owner_email: string;
  jira_url: string | null;
}

/** A partial change: a key left out is left alone, and `jira_url: null` clears the link. */
export type ProductChange = Partial<ProductCreate> & { active?: boolean };

const enc = encodeURIComponent;

function productsPath(teamId: string): string {
  return `/teams/${enc(teamId)}/products`;
}

/** The team's products ordered by name, inactive ones included. */
export function listProducts(teamId: string): Promise<Product[]> {
  return request<Product[]>(productsPath(teamId));
}

export function getProduct(teamId: string, productId: string): Promise<Product> {
  return request<Product>(`${productsPath(teamId)}/${enc(productId)}`);
}

export function createProduct(teamId: string, product: ProductCreate): Promise<Product> {
  return request<Product>(productsPath(teamId), {
    method: 'POST',
    body: JSON.stringify(product),
  });
}

export function changeProduct(
  teamId: string,
  productId: string,
  change: ProductChange,
): Promise<Product> {
  return request<Product>(`${productsPath(teamId)}/${enc(productId)}`, {
    method: 'PATCH',
    body: JSON.stringify(change),
  });
}

/**
 * Delete a product with its metrics. Refused with `product.has_values` once
 * any of them has a value, and with `metric.derivation_source` while one is a
 * derivation's source: make it inactive instead.
 */
export function deleteProduct(teamId: string, productId: string): Promise<void> {
  return request<void>(`${productsPath(teamId)}/${enc(productId)}`, { method: 'DELETE' });
}
