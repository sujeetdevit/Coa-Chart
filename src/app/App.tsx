import { useEffect, useState } from 'react';
import {
  createSuppliedSnapshotSource,
  formatCoaDateTime,
  normalizeSnapshot,
} from '../current-chart/adapters';
import type { CurrentChartModel } from '../current-chart/domain';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; model: CurrentChartModel };

/**
 * Temporary shell: loads and normalises the supplied snapshot. The chart itself arrives in Phase 4.
 */
export function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    createSuppliedSnapshotSource()
      .load({}, controller.signal)
      .then((raw) => {
        setState({ status: 'ready', model: normalizeSnapshot(raw) });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      controller.abort();
    };
  }, []);

  return (
    <main className="app-shell">
      <h1>Current Chart</h1>
      {state.status === 'loading' && <p>Loading snapshot…</p>}
      {state.status === 'error' && <p className="error">{state.message}</p>}
      {state.status === 'ready' && <ModelSummary model={state.model} />}
    </main>
  );
}

function ModelSummary({ model }: { model: CurrentChartModel }) {
  const rows: [string, string | number][] = [
    ['Board', model.board.id ?? '—'],
    ['Snapshot time (IST)', formatCoaDateTime(model.asOf)],
    ['Sections', model.board.sections.map((s) => `${s.id} (${s.stationCodes.length})`).join(', ')],
    ['Stations', model.board.stations.length],
    ['Trains', model.trains.length],
    ['Train events', model.trains.reduce((n, t) => n + t.events.length, 0)],
    ['Blocks', model.blocks.length],
    ['Cautions', model.cautions.length],
    ['Train remarks', model.trainRemarks.length],
  ];
  return (
    <>
      <table className="summary">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th>{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Diagnostics ({model.diagnostics.length})</h2>
      <ul>
        {model.diagnostics.map((d, i) => (
          <li key={i} className={`diag-${d.severity}`}>
            [{d.severity}] {d.source}
            {d.row === undefined ? '' : ` row ${d.row}`}: {d.message}
          </li>
        ))}
      </ul>
    </>
  );
}
