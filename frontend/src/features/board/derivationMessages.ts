import type { TFunction } from 'i18next';
import { ApiError } from '../../api/client';
import type { MetricDefinition } from '../../api/metrics';
import { describeFailure, translateErrorCode } from '../../i18n/apiErrors';
import { sourceName } from '../metrics/DerivationEditor';

/**
 * Why deriving was refused, one sentence per missing piece, each source named
 * from the metric's own derivation by its place in the list. Shared by the
 * recording view and the metric detail, so a refusal reads the same in both.
 */
export function notDerivedMessage(
  t: TFunction,
  { metric }: { metric: MetricDefinition },
  error: Error | null,
): string {
  if (!(error instanceof ApiError) || error.errors.length === 0) {
    return describeFailure(t, error) ?? t('errors.generic');
  }
  const sources = metric.derivation?.sources ?? [];
  const nameAt = (field: string | null) => {
    const index = Number(/^sources\[(\d+)\]$/.exec(field ?? '')?.[1] ?? 0);
    const source = sources[index];
    return source ? sourceName(t, source, metric.team_id) : '';
  };
  return error.errors
    .map((failure) => {
      if (failure.code === 'derivation.source_missing') {
        return t('recording.sourceMissing', { name: nameAt(failure.field) });
      }
      if (failure.code === 'derivation.previous_missing') {
        return t('recording.previousMissing', { name: nameAt(failure.field) });
      }
      return translateErrorCode(t, failure);
    })
    .join(' ');
}

/** A canonical decimal string with no sign on zero, no leading or trailing zeros. */
function canonical(value: string): string {
  const negative = value.trim().startsWith('-');
  const [whole = '', fraction = ''] = value.trim().replace(/^[-+]/, '').split('.');
  const digits = whole.replace(/^0+/, '') || '0';
  const places = fraction.replace(/0+$/, '');
  const magnitude = places ? `${digits}.${places}` : digits;
  return negative && magnitude !== '0' ? `-${magnitude}` : magnitude;
}

/**
 * Whether two decimal strings are the same number, exactly: "19.500000", as a
 * recorded NUMERIC(21, 6) travels, equals "19.5". Never through `Number`,
 * which could not hold 15 digits and 6 places.
 */
export function sameDecimal(a: string, b: string): boolean {
  return canonical(a) === canonical(b);
}
