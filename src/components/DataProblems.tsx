import type { AdapterDiagnostic } from '../current-chart/domain';

/**
 * Always-visible notice for data that is missing altogether (a dataset that failed to load or
 * was not in the expected form). Row-level notes stay in the collapsible Data notes list.
 */
export function DataProblems({ diagnostics }: { diagnostics: AdapterDiagnostic[] }) {
  const errors = diagnostics.filter((d) => d.severity === 'error');
  if (errors.length === 0) return null;
  return (
    <div className="data-problems" role="alert">
      {errors.map((d, i) => (
        <div key={i}>
          <strong>{d.source}:</strong> {d.message}
        </div>
      ))}
    </div>
  );
}
