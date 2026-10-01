import { useMemo } from 'react';
import { CurrentChartView } from '../components/CurrentChart/CurrentChartView';
import { DiagnosticsPanel } from '../components/DiagnosticsPanel';
import { createSuppliedSnapshotSource } from '../current-chart/adapters';
import { useChartModel } from '../hooks/useChartModel';

export function App() {
  const source = useMemo(() => createSuppliedSnapshotSource(), []);
  const state = useChartModel(source);

  if (state.status === 'loading') return <p className="app-message">Loading Current Chart…</p>;
  if (state.status === 'error') return <p className="app-message error">{state.message}</p>;

  return (
    <div className="app">
      <CurrentChartView model={state.model} />
      <DiagnosticsPanel diagnostics={state.model.diagnostics} />
    </div>
  );
}
