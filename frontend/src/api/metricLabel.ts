/**
 * How a metric is named among a board's other metrics: a project's metric
 * after the project's code, a product's after the product's name, as
 * "PRJ-042 · Budget consumed"; any other metric by its name alone. A
 * project's or product's own page shows the bare name instead.
 */
import type { MetricParent } from './metrics';

export function metricLabel(metric: MetricParent & { name: string }): string {
  const parent = metric.project?.code ?? metric.product?.name;
  return parent ? `${parent} · ${metric.name}` : metric.name;
}
