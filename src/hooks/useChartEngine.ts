import { useCallback, useMemo, useState, type RefObject } from 'react';
import { initialTimeWindow, pannableTimeExtent } from '../current-chart/application/timeWindow';
import type { ChartConfig } from '../current-chart/configuration/chartConfig';
import type { ChartTheme } from '../current-chart/configuration/chartTheme';
import type { CurrentChartModel, TimeRange } from '../current-chart/domain';
import { CurrentChartEngine } from '../current-chart/engine';
import { useElementSize } from './useElementSize';

interface EngineState {
  engine: CurrentChartEngine;
  model: CurrentChartModel;
  config: ChartConfig;
}

/**
 * The chart engine for a model and settings. Created on first measure, resized with the
 * container, and recreated (keeping the visible time range) when the model or settings change.
 */
export function useChartEngine(
  areaRef: RefObject<HTMLElement | null>,
  model: CurrentChartModel,
  config: ChartConfig,
  theme: ChartTheme,
) {
  const size = useElementSize(areaRef);
  const initialWindow = useMemo(() => initialTimeWindow(model.asOf, config), [model.asOf, config]);
  const timeExtent = useMemo(
    () => pannableTimeExtent(model, initialWindow, config),
    [model, initialWindow, config],
  );

  const [state, setState] = useState<EngineState>();
  let engine = state?.engine;
  if (size && size.width > 0 && size.height > 0) {
    const stale = !state || state.model !== model || state.config !== config;
    if (stale) {
      const create = (window: TimeRange) =>
        CurrentChartEngine.create({
          board: model.board,
          stage: size,
          margins: theme.margins,
          window,
          timeExtent,
          now: model.asOf,
          config,
        });
      // Keep what the user was looking at across data refreshes and settings changes.
      engine = state
        ? create(initialWindow).fitWindow(state.engine.getVisibleTimeRange())
        : create(initialWindow);
      setState({ engine, model, config });
    } else if (
      engine &&
      (engine.getChartBounds().stage.width !== size.width ||
        engine.getChartBounds().stage.height !== size.height)
    ) {
      engine = engine.resize(size);
      setState({ ...state, engine });
    }
  }

  const update = useCallback((change: (engine: CurrentChartEngine) => CurrentChartEngine) => {
    setState((prev) => (prev ? { ...prev, engine: change(prev.engine) } : prev));
  }, []);

  return { engine, update, initialWindow };
}
