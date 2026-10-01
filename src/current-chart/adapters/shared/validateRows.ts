import type { z } from 'zod';
import type { AdapterDiagnostic } from '../../domain';

export interface ValidatedRows<T> {
  rows: T[];
  diagnostics: AdapterDiagnostic[];
}

/**
 * Validates an array payload row by row. Invalid rows are dropped and reported instead of
 * failing the whole dataset; a non-array payload is reported as a single error.
 */
export function validateRows<S extends z.ZodType>(
  source: string,
  schema: S,
  payload: unknown,
): ValidatedRows<z.infer<S>> {
  if (!Array.isArray(payload)) {
    return {
      rows: [],
      diagnostics: [{ source, severity: 'error', message: 'Expected an array of rows' }],
    };
  }

  const rows: z.infer<S>[] = [];
  const diagnostics: AdapterDiagnostic[] = [];
  payload.forEach((item: unknown, row) => {
    const result = schema.safeParse(item);
    if (result.success) {
      rows.push(result.data);
    } else {
      const issue = result.error.issues[0];
      const path = issue?.path.join('.') ?? '';
      diagnostics.push({
        source,
        severity: 'warning',
        row,
        message: `Row skipped: ${path ? `${path}: ` : ''}${issue?.message ?? 'invalid'}`,
      });
    }
  });
  return { rows, diagnostics };
}
