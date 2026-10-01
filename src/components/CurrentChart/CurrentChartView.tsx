import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  defaultDisplayOptions,
  type ChartDisplayOptions,
} from '../../current-chart/application/displayOptions';
import { buildOverlayScene, overlayAt, type OverlayHit } from '../../current-chart/application/overlayScene';
import { describeTrainHover } from '../../current-chart/application/trainDescriptions';
import { buildTrainScene } from '../../current-chart/application/trainScene';
import { initialTimeWindow, pannableTimeExtent } from '../../current-chart/application/timeWindow';
import { DEFAULT_CHART_CONFIG } from '../../current-chart/configuration/chartConfig';
import { DEFAULT_CHART_THEME } from '../../current-chart/configuration/chartTheme';
import type { CurrentChartModel, TimeRange } from '../../current-chart/domain';
import { computeDwellLanes, CurrentChartEngine, TrainHitIndex, type Size } from '../../current-chart/engine';
import { sameHover, trainAt } from '../../current-chart/interactions/trainPointer';
import { viewportActionFor } from '../../current-chart/interactions/viewportGestures';
import { buildBaseRenderModel } from '../../current-chart/rendering/build/buildBaseRenderModel';
import {
  buildInteractionLayer,
  type ChartHover,
} from '../../current-chart/rendering/build/buildInteractionLayer';
import {
  buildAnnotationGroups,
  buildInfrastructureLayer,
} from '../../current-chart/rendering/build/buildInfrastructureLayer';
import { buildMovementLayer } from '../../current-chart/rendering/build/buildMovementLayer';
import { composeRenderModel } from '../../current-chart/rendering/build/composeRenderModel';
import type { ChartGesture } from '../../current-chart/rendering/types';
import { useBlinkPhase } from '../../hooks/useBlinkPhase';
import { useElementSize } from '../../hooks/useElementSize';
import { ChartCanvas } from './ChartCanvas';
import { ChartHeader } from './ChartHeader';
import { ChartTooltip, type ChartTooltipHandle } from './ChartTooltip';
import { TrainDetailsPanel } from './TrainDetailsPanel';

const config = DEFAULT_CHART_CONFIG;
const theme = DEFAULT_CHART_THEME;

interface CurrentChartViewProps {
  model: CurrentChartModel;
}

export function CurrentChartView({ model }: CurrentChartViewProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<ChartTooltipHandle>(null);
  const size = useElementSize(areaRef);

  const initialWindow = useMemo(() => initialTimeWindow(model.asOf, config), [model.asOf]);
  const timeExtent = useMemo(() => pannableTimeExtent(model, initialWindow, config), [model, initialWindow]);
  const lanes = useMemo(() => computeDwellLanes(model.trains, config.dwellLanes), [model]);

  // ── engine: recreated when the model changes, resized when the area changes ──
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

  // ── UI state ──
  const [options, setOptions] = useState<ChartDisplayOptions>(() => defaultDisplayOptions(config));
  const [hover, setHover] = useState<ChartHover>();
  const [overlayHover, setOverlayHover] = useState<OverlayHit>();
  const [selectedId, setSelectedId] = useState<string>();

  // ── derived scenes, hit indexes and layers ──
  const scene = useMemo(
    () => (engine ? buildTrainScene(engine, model, lanes, config) : undefined),
    [engine, model, lanes],
  );
  const overlays = useMemo(
    () => (engine ? buildOverlayScene(engine, model, theme, model.asOf) : undefined),
    [engine, model],
  );
  const hitIndex = useMemo(
    () => (scene ? new TrainHitIndex(scene.items.map((i) => i.actual)) : undefined),
    [scene],
  );
  const blinkOff = useBlinkPhase(scene?.items.some((i) => i.crewOverDuty) ?? false, config.crew);

  const base = useMemo(() => (engine ? buildBaseRenderModel(engine, theme) : undefined), [engine]);
  const infrastructure = useMemo(
    () => (engine && overlays ? buildInfrastructureLayer(overlays, engine, theme) : []),
    [engine, overlays],
  );
  const annotations = useMemo(
    () => (engine && overlays ? buildAnnotationGroups(overlays, engine, theme) : []),
    [engine, overlays],
  );
  const movement = useMemo(
    () =>
      engine && scene
        ? [...buildMovementLayer(scene, engine, options, config, theme, blinkOff), ...annotations]
        : [],
    [engine, scene, options, blinkOff, annotations],
  );
  const interaction = useMemo(
    () =>
      engine && scene
        ? buildInteractionLayer(scene, engine, hover, selectedId, theme, overlayHover?.rect)
        : [],
    [engine, scene, hover, selectedId, overlayHover],
  );
  const renderModel = useMemo(
    () => (base ? composeRenderModel(base, { infrastructure, movement, interaction }) : undefined),
    [base, infrastructure, movement, interaction],
  );

  // Latest values for the gesture handler, which is registered once.
  const live = useRef({ engine, scene, overlays, hitIndex, hover, overlayHover });
  useEffect(() => {
    live.current = { engine, scene, overlays, hitIndex, hover, overlayHover };
  });

  const update = useCallback((change: (engine: CurrentChartEngine) => CurrentChartEngine) => {
    setEngineState((prev) => (prev ? { model: prev.model, engine: change(prev.engine) } : prev));
  }, []);

  const pointerAt = useCallback((x: number, y: number): ChartHover | undefined => {
    const { engine: e, hitIndex: index } = live.current;
    return e && index ? trainAt(x, y, e, index) : undefined;
  }, []);

  const setOverlay = useCallback((hit: OverlayHit | undefined) => {
    if (hit?.id !== live.current.overlayHover?.id) setOverlayHover(hit);
  }, []);

  const showTrainHover = useCallback((next: ChartHover | undefined, x: number, y: number) => {
    if (!sameHover(next, live.current.hover)) setHover(next);
    if (areaRef.current) areaRef.current.style.cursor = next ? 'pointer' : '';
    const item = next ? live.current.scene?.byId.get(next.trainId) : undefined;
    if (!next || !item) {
      tooltipRef.current?.hide();
      return;
    }
    const point = next.pointIndex !== undefined ? item.actual.points[next.pointIndex] : undefined;
    const floating = item.markers.floating;
    const isFloating =
      point !== undefined &&
      floating !== undefined &&
      point.eventIndex === floating.eventIndex &&
      (point.kind === floating.at || point.kind === 'through');
    tooltipRef.current?.show(describeTrainHover(item.train, point, isFloating), x, y);
  }, []);

  /**
   * Hover priority: small overlay targets (icons, boxes, remarks), then trains, then large
   * overlay areas (blocks), so trains running through a block stay hoverable.
   */
  const showHover = useCallback(
    (x: number, y: number) => {
      const { overlays: o } = live.current;
      const top = o ? overlayAt(o.topHits, x, y) : undefined;
      const train = top ? undefined : pointerAt(x, y);
      const bottom = top || train || !o ? undefined : overlayAt(o.bottomHits, x, y);
      const overlay = top ?? bottom;
      setOverlay(overlay);
      if (overlay) {
        if (live.current.hover) setHover(undefined);
        if (areaRef.current) areaRef.current.style.cursor = 'help';
        tooltipRef.current?.show(overlay.tooltip, x, y);
        return;
      }
      showTrainHover(train, x, y);
    },
    [pointerAt, setOverlay, showTrainHover],
  );

  const hideHover = useCallback(() => {
    setOverlay(undefined);
    showTrainHover(undefined, 0, 0);
  }, [setOverlay, showTrainHover]);

  const onGesture = useCallback(
    (gesture: ChartGesture) => {
      switch (gesture.type) {
        case 'pointerMove':
          showHover(gesture.x, gesture.y);
          return;
        case 'pointerLeave':
          hideHover();
          return;
        case 'click':
          setSelectedId(pointerAt(gesture.x, gesture.y)?.trainId);
          return;
        case 'drag':
        case 'wheel':
          hideHover();
          break;
        case 'doubleClick':
          break;
      }
      update((current) => {
        const action = viewportActionFor(gesture, current);
        if (action.kind === 'engine') return action.engine;
        if (action.kind === 'reset') return current.fitWindow(initialWindow);
        return current;
      });
    },
    [update, initialWindow, pointerAt, showHover, hideHover],
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

  const selectedTrain = selectedId ? model.trains.find((t) => t.id === selectedId) : undefined;

  return (
    <div className="chart-view">
      <ChartHeader
        model={model}
        visible={engine?.getVisibleTimeRange()}
        options={options}
        onOptionsChange={setOptions}
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
        <ChartTooltip ref={tooltipRef} />
        {selectedTrain && (
          <TrainDetailsPanel
            train={selectedTrain}
            onClose={() => {
              setSelectedId(undefined);
            }}
          />
        )}
      </div>
    </div>
  );
}

function createEngine(model: CurrentChartModel, stage: Size, window: TimeRange, timeExtent: TimeRange) {
  return CurrentChartEngine.create({
    board: model.board,
    stage,
    margins: theme.margins,
    window,
    timeExtent,
    now: model.asOf,
    config,
  });
}
