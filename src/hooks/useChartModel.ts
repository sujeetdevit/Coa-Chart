import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DATASET_KEYS,
  normalizeSnapshot,
  type ChartDataSource,
  type RawChartSnapshot,
} from '../current-chart/adapters';
import { Refresher, type RefreshState } from '../current-chart/application/refresh';
import type { CurrentChartModel } from '../current-chart/domain';

export interface ChartRefreshOptions {
  auto: boolean;
  intervalSeconds: number;
}

function unchanged(a: RawChartSnapshot, b: RawChartSnapshot): boolean {
  return (
    DATASET_KEYS.every((key) => a[key] === b[key]) &&
    JSON.stringify(a.loadErrors ?? {}) === JSON.stringify(b.loadErrors ?? {})
  );
}

/** Loads a snapshot and turns it into a chart model; an unchanged snapshot keeps the same model. */
function modelLoader(source: ChartDataSource) {
  let last: { raw: RawChartSnapshot; model: CurrentChartModel } | undefined;
  return async (signal: AbortSignal): Promise<CurrentChartModel> => {
    const raw = await source.load({}, signal);
    if (last && unchanged(last.raw, raw)) return last.model;
    last = { raw, model: normalizeSnapshot(raw) };
    return last.model;
  };
}

/**
 * The chart model from a data source: loaded on mount, reloaded on demand and, when `auto` is
 * on, every `intervalSeconds`. Automatic refreshes wait while the page is hidden. A failed
 * refresh keeps the model already shown.
 */
export function useChartModel(source: ChartDataSource, refresh: ChartRefreshOptions) {
  const [state, setState] = useState<RefreshState<CurrentChartModel>>({ status: 'loading' });
  const refresherRef = useRef<Refresher<CurrentChartModel>>(undefined);
  const intervalMs = refresh.auto ? refresh.intervalSeconds * 1000 : undefined;
  const intervalRef = useRef(intervalMs);

  useEffect(() => {
    const refresher = new Refresher(modelLoader(source));
    refresherRef.current = refresher;
    const unsubscribe = refresher.subscribe(() => {
      setState(refresher.getState());
    });
    const onVisibility = () => {
      refresher.setPaused(document.hidden);
    };
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    refresher.setAutoRefresh(intervalRef.current);
    void refresher.reload();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      unsubscribe();
      refresher.stop();
      refresherRef.current = undefined;
    };
  }, [source]);

  useEffect(() => {
    intervalRef.current = intervalMs;
    refresherRef.current?.setAutoRefresh(intervalMs);
  }, [intervalMs]);

  const reload = useCallback(() => {
    void refresherRef.current?.reload();
  }, []);

  return { state, reload };
}
