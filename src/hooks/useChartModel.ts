import { useEffect, useState } from 'react';
import { normalizeSnapshot, type ChartDataSource } from '../current-chart/adapters';
import type { CurrentChartModel } from '../current-chart/domain';

export type ChartModelState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; model: CurrentChartModel };

/** Loads a snapshot from a data source and normalises it into the chart model. */
export function useChartModel(source: ChartDataSource): ChartModelState {
  const [state, setState] = useState<ChartModelState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    source
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
  }, [source]);

  return state;
}
