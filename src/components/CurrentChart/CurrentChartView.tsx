import { useCallback, useMemo, useRef, useState } from 'react';
import { initialTimeWindow, pannableTimeExtent } from '../../current-chart/application/timeWindow';
import { DEFAULT_CHART_CONFIG } from '../../current-chart/configuration/chartConfig';
import { DEFAULT_CHART_THEME } from '../../current-chart/configuration/chartTheme';
import type { CurrentChartModel } from '../../current-chart/domain';
import { CurrentChartEngine, type Size } from '../../current-chart/engine';
import { viewportActionFor } from '../../current-chart/interactions/viewportGestures';
import { buildBaseRenderModel } from '../../current-chart/rendering/build/buildBaseRenderModel';
import type { ChartGesture } from '../../current-chart/rendering/types';
import { useElementSize } from '../../hooks/useElementSize';
import { ChartCanvas } from './ChartCanvas';
import { ChartHeader } from './ChartHeader';

const config = DEFAULT_CHART_CONFIG;
const theme = DEFAULT_CHART_THEME;

interface CurrentChartViewProps {
  model: CurrentChartModel;
}

export function CurrentChartView({ model }: CurrentChartViewProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(areaRef);

  const initialWindow = useMemo(() => initialTimeWindow(model.asOf, config), [model.asOf]);
  const timeExtent = useMemo(() => pannableTimeExtent(model, initialWindow, config), [model, initialWindow]);

  // Engine state; recreated when the model changes, resized when the area changes.
  const [engineState, setEngineState] = useState<{ engine: CurrentChartEngine; model: CurrentChartModel }>();
  let engine = engineState?.model === model ? engineState.engine : undefined;
  if (size && size.width > 0 && size.height > 0) {
    if (!engine) {
      engine = createEngine(model, size, initialWindow, timeExtent);
      setEngineState({ engine, model });
    } else if (
      engine.getChartBounds().stage.width !== size.width ||
      engine.getChartBounds().stage.height !== size.height
    ) {
      engine = engine.resize(size);
      setEngineState({ engine, model });
    }
  }

  const renderModel = useMemo(() => (engine ? buildBaseRenderModel(engine, theme) : undefined), [engine]);

  const update = useCallback((change: (engine: CurrentChartEngine) => CurrentChartEngine) => {
    setEngineState((prev) => (prev ? { model: prev.model, engine: change(prev.engine) } : prev));
  }, []);

  const onGesture = useCallback(
    (gesture: ChartGesture) => {
      update((current) => {
        const action = viewportActionFor(gesture, current);
        if (action.kind === 'engine') return action.engine;
        if (action.kind === 'reset') return current.fitWindow(initialWindow);
        return current;
      });
    },
    [update, initialWindow],
  );

  const zoom = useCallback(
    (factorX: number, factorY: number) => {
      update((current) => {
        const { plot } = current.getChartBounds();
        return current.zoomAt({ x: plot.width / 2, y: plot.height / 2 }, factorX, factorY);
      });
    },
    [update],
  );

  return (
    <div className="chart-view">
      <ChartHeader
        model={model}
        visible={engine?.getVisibleTimeRange()}
        onReset={() => {
          update((current) => current.fitWindow(initialWindow));
        }}
        onZoomTime={(f) => {
          zoom(f, 1);
        }}
        onZoomStations={(f) => {
          zoom(1, f);
        }}
      />
      <div ref={areaRef} className="chart-area">
        <ChartCanvas renderModel={renderModel} onGesture={onGesture} />
      </div>
    </div>
  );
}

function createEngine(
  model: CurrentChartModel,
  stage: Size,
  initialWindow: { start: number; end: number },
  timeExtent: { start: number; end: number },
): CurrentChartEngine {
  return CurrentChartEngine.create({
    board: model.board,
    stage,
    margins: theme.margins,
    window: initialWindow,
    timeExtent,
    now: model.asOf,
    config,
  });
}
