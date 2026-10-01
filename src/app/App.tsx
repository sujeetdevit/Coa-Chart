import { useMemo } from 'react';
import type { ChartServices } from '../components/CurrentChart/chartServices';
import { CurrentChartView } from '../components/CurrentChart/CurrentChartView';
import { DiagnosticsPanel } from '../components/DiagnosticsPanel';
import { createSuppliedSnapshotSource } from '../current-chart/adapters';
import { createSampleForecastProvider, SampleMsmProvider } from '../current-chart/adapters/samples';
import { InMemoryEpenStore } from '../current-chart/application/epen';
import { useChartModel } from '../hooks/useChartModel';

export function App() {
  const source = useMemo(() => createSuppliedSnapshotSource(), []);
  // No forecast, MSM or EPEN APIs were supplied: clearly labelled samples / in-memory stand-ins.
  const services = useMemo<ChartServices>(
    () => ({
      forecast: createSampleForecastProvider(),
      msm: new SampleMsmProvider(),
      epen: new InMemoryEpenStore(),
    }),
    [],
  );
  const state = useChartModel(source);

  if (state.status === 'loading') return <p className="app-message">Loading Current Chart…</p>;
  if (state.status === 'error') return <p className="app-message error">{state.message}</p>;

  return (
    <div className="app">
      <CurrentChartView model={state.model} services={services} />
      <DiagnosticsPanel diagnostics={state.model.diagnostics} />
    </div>
  );
}
