import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  changeProduct,
  createProduct,
  deleteProduct,
  listProducts,
  type Product,
  type ProductChange,
  type ProductCreate,
} from '../../api/products';
import {
  changeProject,
  createProject,
  deleteProject,
  listProjects,
  type Project,
  type ProjectChange,
  type ProjectCreate,
} from '../../api/projects';
import { metricsQueryKey } from '../metrics/useMetrics';

/*
 * A team's projects and products, each under its own prefix so that one
 * project's read sits under the list's key and is refreshed with it.
 */
export function projectsQueryKey(teamId: string) {
  return ['teams', teamId, 'projects'] as const;
}

export function productsQueryKey(teamId: string) {
  return ['teams', teamId, 'products'] as const;
}

export function useProjects(teamId: string) {
  return useQuery<Project[]>({
    queryKey: projectsQueryKey(teamId),
    queryFn: () => listProjects(teamId),
  });
}

export function useProducts(teamId: string) {
  return useQuery<Product[]>({
    queryKey: productsQueryKey(teamId),
    queryFn: () => listProducts(teamId),
  });
}

/**
 * A change to a project or product reaches the board as well: its metrics
 * carry it in their label, and while it is inactive they are retired.
 */
function refresh(queryClient: QueryClient, key: readonly unknown[], teamId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: key }),
    queryClient.invalidateQueries({ queryKey: metricsQueryKey(teamId) }),
  ]);
}

export function useCreateProject(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (project: ProjectCreate) => createProject(teamId, project),
    onSuccess: () => refresh(queryClient, projectsQueryKey(teamId), teamId),
  });
}

export function useChangeProject(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: ProjectChange }) =>
      changeProject(teamId, id, change),
    onSuccess: () => refresh(queryClient, projectsQueryKey(teamId), teamId),
  });
}

export function useDeleteProject(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProject(teamId, id),
    onSuccess: () => refresh(queryClient, projectsQueryKey(teamId), teamId),
  });
}

export function useCreateProduct(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (product: ProductCreate) => createProduct(teamId, product),
    onSuccess: () => refresh(queryClient, productsQueryKey(teamId), teamId),
  });
}

export function useChangeProduct(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: ProductChange }) =>
      changeProduct(teamId, id, change),
    onSuccess: () => refresh(queryClient, productsQueryKey(teamId), teamId),
  });
}

export function useDeleteProduct(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProduct(teamId, id),
    onSuccess: () => refresh(queryClient, productsQueryKey(teamId), teamId),
  });
}
