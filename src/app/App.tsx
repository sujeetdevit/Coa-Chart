import { useMemo, useState } from 'react';
import type { ChartRefreshControls, ChartServices } from '../components/CurrentChart/chartServices';
import { CurrentChartView } from '../components/CurrentChart/CurrentChartView';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { DataProblems } from '../components/DataProblems';
import { DiagnosticsPanel } from '../components/DiagnosticsPanel';
import { createApiSource, createSuppliedSnapshotSource } from '../current-chart/adapters';
import { createSampleForecastProvider, SampleMsmProvider } from '../current-chart/adapters/samples';
import { InMemoryEpenStore } from '../current-chart/application/epen';
import { DEFAULT_CHART_CONFIG } from '../current-chart/configuration/chartConfig';
import { useChartModel } from '../hooks/useChartModel';

export function App() {
  // The one place the data source is chosen: the API when VITE_API_BASE_URL is set, else the supplied JSON files.
  const source = useMemo(() => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    return apiBaseUrl ? createApiSource(apiBaseUrl) : createSuppliedSnapshotSource();
  }, []);
  // No forecast, MSM or EPEN APIs were supplied: clearly labelled samples / in-memory stand-ins.
  const services = useMemo<ChartServices>(
    () => ({
      forecast: createSampleForecastProvider(),
      msm: new SampleMsmProvider(),
      epen: new InMemoryEpenStore(),
    }),
    [],
  );
  const [auto, setAuto] = useState(DEFAULT_CHART_CONFIG.refresh.autoRefreshEnabled);
  const { intervalSeconds } = DEFAULT_CHART_CONFIG.refresh;
  const { state, reload } = useChartModel(source, { auto, intervalSeconds });

  if (state.status === 'loading') return <p className="app-message">Loading Current Chart…</p>;
  if (state.status === 'failed') {
    return (
      <div className="app-message error" role="alert">
        <p>
          <strong>The chart data could not be loaded.</strong> {state.error}
        </p>
        <button type="button" onClick={reload}>
          Try again
        </button>
      </div>
    );
  }

  const refresh: ChartRefreshControls = {
    loadedAt: state.loadedAt,
    refreshing: state.refreshing,
    ...(state.refreshError === undefined ? {} : { error: state.refreshError }),
    auto,
    intervalSeconds,
    onAutoChange: setAuto,
    onRefresh: reload,
  };

  return (
    <div className="app">
      <DataProblems diagnostics={state.data.diagnostics} />
      <ErrorBoundary what="The chart could not be drawn.">
        <CurrentChartView model={state.data} services={services} refresh={refresh} />
      </ErrorBoundary>
      <DiagnosticsPanel diagnostics={state.data.diagnostics} />
    </div>
  );
}
