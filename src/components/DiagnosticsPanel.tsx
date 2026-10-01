import type { AdapterDiagnostic } from '../current-chart/domain';

/** Collapsible list of data issues found while loading the snapshot. */
export function DiagnosticsPanel({ diagnostics }: { diagnostics: AdapterDiagnostic[] }) {
  if (diagnostics.length === 0) return null;
  const warnings = diagnostics.filter((d) => d.severity !== 'info').length;
  return (
    <details className="diagnostics">
      <summary>
        Data notes: {diagnostics.length}
        {warnings > 0 ? ` (${warnings} warnings)` : ''}
      </summary>
      <ul>
        {diagnostics.map((d, i) => (
          <li key={i} className={`diag-${d.severity}`}>
            [{d.severity}] {d.source}
            {d.row === undefined ? '' : ` row ${d.row}`}: {d.message}
          </li>
        ))}
      </ul>
    </details>
  );
}
