import { useEffect, useState } from 'react';
import {
  createSuppliedSnapshotSource,
  validateSnapshot,
  type SnapshotValidation,
} from '../current-chart/adapters';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; validation: SnapshotValidation };

/**
 * Phase 2 shell: loads and validates the supplied snapshot. The chart itself arrives in Phase 4.
 */
export function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    createSuppliedSnapshotSource()
      .load({}, controller.signal)
      .then((raw) => {
        setState({ status: 'ready', validation: validateSnapshot(raw) });
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
      {state.status === 'ready' && <SnapshotSummary validation={state.validation} />}
    </main>
  );
}

function SnapshotSummary({ validation }: { validation: SnapshotValidation }) {
  const { snapshot, diagnostics } = validation;
  return (
    <>
      <table className="summary">
        <thead>
          <tr>
            <th>Dataset</th>
            <th>Valid rows</th>
          </tr>
        </thead>
        <tbody>
          {(Object.keys(snapshot) as (keyof typeof snapshot)[]).map((name) => (
            <tr key={name}>
              <td>{name}</td>
              <td>{snapshot[name].length}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>{diagnostics.length === 0 ? 'No validation issues.' : `${diagnostics.length} validation issues.`}</p>
      {diagnostics.length > 0 && (
        <ul>
          {diagnostics.slice(0, 20).map((d, i) => (
            <li key={i}>
              {d.source}
              {d.row === undefined ? '' : ` row ${d.row}`}: {d.message}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
