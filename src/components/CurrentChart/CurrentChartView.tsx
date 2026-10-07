import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  defaultDisplayOptions,
  type ChartDisplayOptions,
} from '../../current-chart/application/displayOptions';
import { withForecasts } from '../../current-chart/application/forecast/forecastDisplay';
import { msmRequestFor, type MsmRequest } from '../../current-chart/application/msm';
import {
  defaultPrintOptions,
  messagesToPrint,
  PRINT_STAGE,
  printDisplayOptions,
  printRange,
  type PrintOptions,
} from '../../current-chart/application/printChart';
import { buildOverlayScene, overlayAt, type OverlayHit } from '../../current-chart/application/overlayScene';
import {
  describeTrainHover,
  formatIstDateTime,
  trainTitle,
} from '../../current-chart/application/trainDescriptions';
import { isTrainVisible, NO_FILTERS, type TrainFilters } from '../../current-chart/application/trainFilters';
import { buildTrainScene } from '../../current-chart/application/trainScene';
import { DEFAULT_CHART_CONFIG, type ChartConfig } from '../../current-chart/configuration/chartConfig';
import { DEFAULT_CHART_THEME, withColumnWidths } from '../../current-chart/configuration/chartTheme';
import type { CurrentChartModel, EpenMessage, Station } from '../../current-chart/domain';
import { computeDwellLanes, CurrentChartEngine, TrainHitIndex, type Rect } from '../../current-chart/engine';
import {
  COLUMN_TITLES,
  columnEdgeAt,
  draggedWidth,
  type ColumnWidths,
  type ResizableColumn,
} from '../../current-chart/interactions/columnResize';
import {
  forecastPointAt,
  rectBetween,
  sameHover,
  trainAt,
} from '../../current-chart/interactions/trainPointer';
import { viewportActionFor } from '../../current-chart/interactions/viewportGestures';
import { buildBaseRenderModel } from '../../current-chart/rendering/build/buildBaseRenderModel';
import {
  buildAnnotationGroups,
  buildInfrastructureLayer,
} from '../../current-chart/rendering/build/buildInfrastructureLayer';
import {
  buildInteractionLayer,
  type ChartHover,
} from '../../current-chart/rendering/build/buildInteractionLayer';
import { buildMovementLayer } from '../../current-chart/rendering/build/buildMovementLayer';
import { buildStaticRenderModel } from '../../current-chart/rendering/build/buildStaticRenderModel';
import { composeRenderModel } from '../../current-chart/rendering/build/composeRenderModel';
import { renderToImage } from '../../current-chart/rendering/konva';
import type { ChartGesture } from '../../current-chart/rendering/types';
import { useBlinkPhase } from '../../hooks/useBlinkPhase';
import { useChartEngine } from '../../hooks/useChartEngine';
import { useForecastWorkflow } from '../../hooks/useForecastWorkflow';
import { useFreezableModel } from '../../hooks/useFreezableModel';
import { ChartCanvas } from './ChartCanvas';
import { ChartContextMenu, type ContextMenuItem } from './ChartContextMenu';
import { ChartHeader } from './ChartHeader';
import type { ChartRefreshControls, ChartServices } from './chartServices';
import { ChartToolbar, type ChartPanel, type ChartTool } from './ChartToolbar';
import { ChartTooltip, type ChartTooltipHandle } from './ChartTooltip';
import { ForecastBar } from './ForecastBar';
import { HaltDialog } from './HaltDialog';
import { LegendPanel, SummaryPanel } from './LegendPanel';
import { MessageViewer } from './MessageViewer';
import { MsmWindow } from './MsmWindow';
import { SettingsDialog } from './SettingsDialog';
import { TrainDetailsPanel } from './TrainDetailsPanel';
import { WritePadDialog } from './WritePadDialog';

// Loaded on first use: printing is occasional and its form is not needed to draw the chart.
const PrintDialog = lazy(() => import('./PrintDialog'));

/** Both side columns at full width: how the chart opens, and how it is always printed. */
const FULL_COLUMNS: ColumnWidths = {
  caution: DEFAULT_CHART_THEME.layout.cautionColumn,
  occupancy: DEFAULT_CHART_THEME.layout.occupancyColumn,
};

interface CurrentChartViewProps {
  model: CurrentChartModel;
  services: ChartServices;
  refresh: ChartRefreshControls;
}

/** Where a right-click happened: the chart time and station row under it, and any train. */
interface ContextTarget {
  x: number;
  y: number;
  at: number;
  station?: Station;
  trainId?: string;
}

type DragMode =
  | { kind: 'pan' }
  | { kind: 'zoomBox'; start: { x: number; y: number } }
  | { kind: 'column'; column: ResizableColumn; startX: number; startWidth: number }
  | { kind: 'forecast'; trainId: string; pointIndex: number; field: 'arrival' | 'departure' };

export function CurrentChartView({ model: incoming, services, refresh }: CurrentChartViewProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<ChartTooltipHandle>(null);

  // ── side columns: narrowed or hidden by dragging their left edge; not remembered ──
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(FULL_COLUMNS);
  const theme = useMemo(() => withColumnWidths(DEFAULT_CHART_THEME, columnWidths), [columnWidths]);
  /** The column splitter under the pointer or being dragged (drawn highlighted). */
  const [activeColumn, setActiveColumn] = useState<ResizableColumn>();

  // ── settings, freeze, filters ──
  const [config, setConfig] = useState<ChartConfig>(DEFAULT_CHART_CONFIG);
  const freeze = useFreezableModel(incoming);
  const baseModel = freeze.model;
  const [options, setOptions] = useState<ChartDisplayOptions>(() =>
    defaultDisplayOptions(DEFAULT_CHART_CONFIG),
  );
  const [filters, setFilters] = useState<TrainFilters>(NO_FILTERS);
  const [tool, setTool] = useState<ChartTool>('pan');
  const [msmMode, setMsmMode] = useState(false);
  const [panel, setPanel] = useState<ChartPanel>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  const visibleTrainIds = useMemo(
    () => baseModel.trains.filter((t) => isTrainVisible(t, filters)).map((t) => t.id),
    [baseModel, filters],
  );
  const forecast = useForecastWorkflow(services.forecast, baseModel, visibleTrainIds);
  const [haltOpen, setHaltOpen] = useState(false);

  // ── EPEN ──
  const [savedMessages, setSavedMessages] = useState<EpenMessage[]>([]);
  const [shownMessages, setShownMessages] = useState<EpenMessage[] | undefined>();
  const [writePad, setWritePad] = useState<ContextTarget>();
  const [viewing, setViewing] = useState<EpenMessage>();
  const [contextMenu, setContextMenu] = useState<ContextTarget>();
  const [msm, setMsm] = useState<MsmRequest>();

  // ── the model drawn: frozen data + forecasts + EPEN messages ──
  const model = useMemo(() => {
    const messages = shownMessages ?? savedMessages;
    const withF = withForecasts(baseModel, forecast.state.shown, baseModel.asOf, config.forecast);
    return { ...withF, epenMessages: messages };
  }, [baseModel, forecast.state.shown, config.forecast, shownMessages, savedMessages]);

  const { engine, update, initialWindow } = useChartEngine(areaRef, baseModel, config, theme);

  // ── interaction state ──
  const [hover, setHover] = useState<ChartHover>();
  const [overlayHover, setOverlayHover] = useState<OverlayHit>();
  const [selectedId, setSelectedId] = useState<string>();
  const [selectionRect, setSelectionRect] = useState<Rect>();

  // ── scenes, hit indexes, layers ──
  const lanes = useMemo(
    () => computeDwellLanes(baseModel.trains, config.dwellLanes),
    [baseModel, config.dwellLanes],
  );
  const scene = useMemo(
    () =>
      engine ? buildTrainScene(engine, model, lanes, config, (t) => isTrainVisible(t, filters)) : undefined,
    [engine, model, lanes, config, filters],
  );
  const overlays = useMemo(
    () => (engine ? buildOverlayScene(engine, model, theme, model.asOf) : undefined),
    [engine, model, theme],
  );
  const hitIndex = useMemo(
    () => (scene ? new TrainHitIndex(scene.items.map((i) => i.actual)) : undefined),
    [scene],
  );
  const forecastIndex = useMemo(
    () =>
      scene
        ? new TrainHitIndex(
            scene.items.map((i) => ({
              trainId: i.train.id,
              // Only forecast vertices are draggable, not the actual vertex the forecast starts from.
              points: i.forecast.points.map((p) => (p.kind === 'forecast' ? p : { ...p, x: -1e6, y: -1e6 })),
            })),
          )
        : undefined,
    [scene],
  );
  const blinkOff = useBlinkPhase(scene?.items.some((i) => i.crewOverDuty) ?? false, config.crew);

  const base = useMemo(() => (engine ? buildBaseRenderModel(engine, theme) : undefined), [engine, theme]);
  const infrastructure = useMemo(
    () => (engine && overlays ? buildInfrastructureLayer(overlays, engine, theme, activeColumn) : []),
    [engine, overlays, theme, activeColumn],
  );
  const annotations = useMemo(
    () => (engine && overlays ? buildAnnotationGroups(overlays, engine, theme) : []),
    [engine, overlays, theme],
  );
  const movement = useMemo(
    () =>
      engine && scene
        ? [...buildMovementLayer(scene, engine, options, config, theme, blinkOff), ...annotations]
        : [],
    [engine, scene, options, config, blinkOff, annotations, theme],
  );
  const interaction = useMemo(
    () =>
      engine && scene
        ? buildInteractionLayer(scene, engine, theme, {
            ...(hover ? { hover } : {}),
            ...(selectedId ? { selectedTrainId: selectedId } : {}),
            ...(overlayHover ? { overlayRect: overlayHover.rect } : {}),
            ...(selectionRect ? { selectionRect } : {}),
          })
        : [],
    [engine, scene, hover, selectedId, overlayHover, selectionRect, theme],
  );
  const renderModel = useMemo(
    () => (base ? composeRenderModel(base, { infrastructure, movement, interaction }) : undefined),
    [base, infrastructure, movement, interaction],
  );

  // Latest values for gesture handling (the renderer's handler is registered once).
  const live = useRef({
    engine,
    scene,
    overlays,
    hitIndex,
    forecastIndex,
    hover,
    overlayHover,
    tool,
    msmMode,
    forecast,
    baseModel,
    columnWidths,
  });
  useEffect(() => {
    live.current = {
      engine,
      scene,
      overlays,
      hitIndex,
      forecastIndex,
      hover,
      overlayHover,
      tool,
      msmMode,
      forecast,
      baseModel,
      columnWidths,
    };
  });
  const drag = useRef<DragMode>({ kind: 'pan' });

  // ── hover ──
  const showTrainHover = useCallback((next: ChartHover | undefined, x: number, y: number) => {
    if (!sameHover(next, live.current.hover)) setHover(next);
    const item = next ? live.current.scene?.byId.get(next.trainId) : undefined;
    if (areaRef.current)
      areaRef.current.style.cursor =
        next?.forecastPointIndex !== undefined ? 'ew-resize' : next ? 'pointer' : '';
    if (!next || !item) {
      tooltipRef.current?.hide();
      return;
    }
    if (next.forecastPointIndex !== undefined) {
      const p = item.forecast.points[next.forecastPointIndex];
      tooltipRef.current?.show(
        {
          title: trainTitle(item.train),
          lines: [`Manual forecast ${p ? formatIstDateTime(p.time) : ''}`, 'Drag to change'],
        },
        x,
        y,
      );
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

  const setOverlay = useCallback((hit: OverlayHit | undefined) => {
    if (hit?.id !== live.current.overlayHover?.id) setOverlayHover(hit);
  }, []);

  const trainHoverAt = useCallback((x: number, y: number): ChartHover | undefined => {
    const { engine: e, hitIndex: index, forecastIndex: fIndex, forecast: f } = live.current;
    if (!e || !index) return undefined;
    if (f.state.mode === 'manual' && fIndex) {
      const point = forecastPointAt(x, y, e, fIndex);
      if (point) return point;
    }
    return trainAt(x, y, e, index);
  }, []);

  /** Small overlay targets, then trains, then large overlay areas (blocks). */
  const showHover = useCallback(
    (x: number, y: number) => {
      const { overlays: o } = live.current;
      const top = o ? overlayAt(o.topHits, x, y) : undefined;
      const train = top ? undefined : trainHoverAt(x, y);
      const bottom = top || train || !o ? undefined : overlayAt(o.bottomHits, x, y);
      const overlay = top ?? bottom;
      setOverlay(overlay);
      if (overlay) {
        if (live.current.hover) setHover(undefined);
        if (areaRef.current)
          areaRef.current.style.cursor = overlay.id.startsWith('msg:') ? 'pointer' : 'help';
        tooltipRef.current?.show(overlay.tooltip, x, y);
        return;
      }
      showTrainHover(train, x, y);
    },
    [trainHoverAt, setOverlay, showTrainHover],
  );

  const hideHover = useCallback(() => {
    setOverlay(undefined);
    showTrainHover(undefined, 0, 0);
  }, [setOverlay, showTrainHover]);

  // ── clicks ──
  const onClick = useCallback((x: number, y: number) => {
    const { overlays: o, engine: e, scene: s, msmMode: msmOn, baseModel: m } = live.current;
    const top = o ? overlayAt(o.topHits, x, y) : undefined;
    if (top?.id.startsWith('msg:')) {
      setViewing(o?.messages.find((msg) => msg.id === top.id)?.message);
      return;
    }
    const hit = e && live.current.hitIndex ? trainAt(x, y, e, live.current.hitIndex) : undefined;
    if (msmOn && hit?.segmentIndex !== undefined) {
      const item = s?.byId.get(hit.trainId);
      const request = item
        ? msmRequestFor(item.train, item.actual.points, hit.segmentIndex, m.board)
        : undefined;
      if (request) {
        setMsm(request);
        return;
      }
    }
    setSelectedId(hit?.trainId);
  }, []);

  // ── gestures ──
  const columnEdgeUnder = useCallback((x: number): ResizableColumn | undefined => {
    const { overlays: o, engine: e } = live.current;
    if (!o || !e) return undefined;
    return columnEdgeAt(
      x,
      { caution: o.columns.caution.x, occupancy: o.columns.occupancy.x },
      e.getChartBounds().stage.width,
    );
  }, []);

  const onGesture = useCallback(
    (gesture: ChartGesture) => {
      const { engine: e } = live.current;
      switch (gesture.type) {
        case 'pointerMove': {
          const column = columnEdgeUnder(gesture.x);
          setActiveColumn(column);
          if (column) {
            hideHover();
            if (areaRef.current) areaRef.current.style.cursor = 'col-resize';
            const hidden = live.current.columnWidths[column] === 0;
            tooltipRef.current?.show(
              {
                title: `${COLUMN_TITLES[column]} column`,
                lines: [hidden ? 'Drag left to show' : 'Drag right to narrow or hide, left to widen'],
              },
              gesture.x,
              gesture.y,
            );
            return;
          }
          showHover(gesture.x, gesture.y);
          return;
        }
        case 'pointerLeave':
          setActiveColumn(undefined);
          hideHover();
          return;
        case 'click':
          onClick(gesture.x, gesture.y);
          return;
        case 'contextMenu': {
          if (!e) return;
          const { plot } = e.getChartBounds();
          const station = e.yToStation(gesture.y - plot.y, 10);
          const trainId = live.current.hitIndex
            ? trainAt(gesture.x, gesture.y, e, live.current.hitIndex)?.trainId
            : undefined;
          hideHover();
          setContextMenu({
            x: gesture.x,
            y: gesture.y,
            at: e.xToTime(gesture.x - plot.x),
            ...(station ? { station } : {}),
            ...(trainId ? { trainId } : {}),
          });
          return;
        }
        case 'dragStart': {
          hideHover();
          const { tool: t, forecast: f, forecastIndex: fIndex, scene: s } = live.current;
          const column = columnEdgeUnder(gesture.x);
          if (column) {
            setActiveColumn(column);
            drag.current = {
              kind: 'column',
              column,
              startX: gesture.x,
              startWidth: live.current.columnWidths[column],
            };
            return;
          }
          if (t === 'zoom') {
            drag.current = { kind: 'zoomBox', start: { x: gesture.x, y: gesture.y } };
            return;
          }
          if (f.state.mode === 'manual' && e && fIndex) {
            const hit = forecastPointAt(gesture.x, gesture.y, e, fIndex);
            const point =
              hit?.forecastPointIndex !== undefined
                ? s?.byId.get(hit.trainId)?.forecast.points[hit.forecastPointIndex]
                : undefined;
            if (hit && point?.forecastField) {
              drag.current = {
                kind: 'forecast',
                trainId: hit.trainId,
                pointIndex: point.eventIndex,
                field: point.forecastField,
              };
              return;
            }
          }
          drag.current = { kind: 'pan' };
          return;
        }
        case 'drag': {
          const mode = drag.current;
          if (mode.kind === 'column') {
            const width = draggedWidth(mode.startWidth, mode.startX, gesture.x, FULL_COLUMNS[mode.column]);
            setColumnWidths((prev) =>
              prev[mode.column] === width ? prev : { ...prev, [mode.column]: width },
            );
            return;
          }
          if (mode.kind === 'zoomBox') {
            setSelectionRect(rectBetween(mode.start, gesture));
            return;
          }
          if (mode.kind === 'forecast' && e) {
            const { plot } = e.getChartBounds();
            live.current.forecast.actions.moveManual(
              mode.trainId,
              mode.pointIndex,
              mode.field,
              e.xToTime(gesture.x - plot.x),
            );
            return;
          }
          break;
        }
        case 'dragEnd': {
          const mode = drag.current;
          drag.current = { kind: 'pan' };
          if (mode.kind === 'column') {
            setActiveColumn(undefined);
            return;
          }
          if (mode.kind === 'zoomBox') {
            setSelectionRect(undefined);
            const r = rectBetween(mode.start, gesture);
            update((current) => {
              const { plot } = current.getChartBounds();
              return current.zoomToRect({ ...r, x: r.x - plot.x, y: r.y - plot.y });
            });
          }
          return;
        }
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
    [update, initialWindow, showHover, hideHover, onClick, columnEdgeUnder],
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

  // ── context menu actions ──
  const contextItems = (target: ContextTarget): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [
      {
        label: 'Write Pad',
        onSelect: () => {
          setWritePad(target);
        },
      },
      shownMessages
        ? {
            label: 'Hide Messages',
            onSelect: () => {
              setShownMessages(undefined);
            },
          }
        : {
            label: 'Message Show',
            onSelect: () => {
              if (!engine) return;
              void services.epen.list(engine.getVisibleTimeRange()).then(setShownMessages);
            },
          },
    ];
    if (target.trainId) {
      const id = target.trainId;
      items.push({
        label: 'Forecast this train',
        onSelect: () => {
          forecast.actions.single(id);
        },
      });
    }
    return items;
  };

  const saveMessage = (target: ContextTarget, payload: string) => {
    const message: EpenMessage = {
      id: `${Date.now()}`,
      at: target.at,
      payload,
      savedAt: Date.now(),
      ...(target.station ? { stationCode: target.station.code, sectionId: target.station.sectionId } : {}),
    };
    void services.epen.save(message).then(() => {
      setSavedMessages((prev) => [...prev, message]);
      setShownMessages((prev) => (prev ? [...prev, message] : prev));
    });
  };

  // ── print ──
  const renderPrintImage = useCallback(
    (print: PrintOptions) => {
      const range = printRange(print);
      const printEngine = CurrentChartEngine.create({
        board: baseModel.board,
        stage: PRINT_STAGE,
        margins: DEFAULT_CHART_THEME.margins,
        window: range,
        timeExtent: range,
        now: baseModel.asOf,
        config,
      });
      const image = buildStaticRenderModel({
        engine: printEngine,
        model: { ...model, epenMessages: messagesToPrint(savedMessages, print) },
        lanes,
        config,
        // Printed with both side columns, whatever is hidden on screen.
        theme: DEFAULT_CHART_THEME,
        options: printDisplayOptions(options, print),
        isVisible: (t) => isTrainVisible(t, filters),
      });
      return renderToImage(image, PRINT_STAGE.pixelRatio);
    },
    [baseModel, model, savedMessages, lanes, config, options, filters],
  );

  const selectedTrain = selectedId ? model.trains.find((t) => t.id === selectedId) : undefined;

  return (
    <div className="chart-view">
      <ChartHeader
        model={baseModel}
        visible={engine?.getVisibleTimeRange()}
        frozen={freeze.frozen}
        refresh={{
          ...refresh,
          // A manual refresh also brings back any side column that was narrowed or hidden.
          onRefresh: () => {
            setColumnWidths(FULL_COLUMNS);
            refresh.onRefresh();
          },
        }}
        onPrint={() => {
          setPrintOpen(true);
        }}
        onReset={() => {
          update((current) => current.fitWindow(initialWindow));
        }}
        onZoomTime={(f) => {
          zoom(f, 1);
        }}
        onZoomStations={(f) => {
          zoom(1, f);
        }}
        onSettings={() => {
          setSettingsOpen(true);
        }}
      />
      <ChartToolbar
        options={options}
        onOptionsChange={setOptions}
        filters={filters}
        onFiltersChange={setFilters}
        tool={tool}
        onToolChange={setTool}
        msm={msmMode}
        onMsmChange={setMsmMode}
        frozen={freeze.frozen}
        hasPending={freeze.hasPending}
        onFrozenChange={freeze.setFrozen}
        panel={panel}
        onPanelChange={setPanel}
      />
      <div ref={areaRef} className={`chart-area ${tool === 'zoom' ? 'tool-zoom' : ''}`}>
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
        {panel === 'legend' && (
          <LegendPanel
            model={baseModel}
            theme={theme}
            onClose={() => {
              setPanel(undefined);
            }}
          />
        )}
        {panel === 'summary' && (
          <SummaryPanel
            model={baseModel}
            onClose={() => {
              setPanel(undefined);
            }}
          />
        )}
        {msm && (
          <MsmWindow
            request={msm}
            provider={services.msm}
            theme={theme}
            onClose={() => {
              setMsm(undefined);
            }}
          />
        )}
        {contextMenu && (
          <ChartContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={contextItems(contextMenu)}
            onClose={() => {
              setContextMenu(undefined);
            }}
          />
        )}
        {writePad && (
          <WritePadDialog
            context={`${formatIstDateTime(writePad.at)}${writePad.station ? ` · ${writePad.station.code}` : ''}`}
            onSave={(payload) => {
              saveMessage(writePad, payload);
            }}
            onClose={() => {
              setWritePad(undefined);
            }}
          />
        )}
        {viewing && (
          <MessageViewer
            message={viewing}
            onClose={() => {
              setViewing(undefined);
            }}
          />
        )}
        {haltOpen && (
          <HaltDialog
            trains={baseModel.trains.filter((t) => visibleTrainIds.includes(t.id))}
            board={baseModel.board}
            halts={forecast.state.halts}
            onRun={(halts) => {
              forecast.actions.full(halts);
            }}
            onClose={() => {
              setHaltOpen(false);
            }}
          />
        )}
        {printOpen && engine && (
          <Suspense fallback={null}>
            <PrintDialog
              boardId={baseModel.board.id}
              initial={defaultPrintOptions(engine.getVisibleTimeRange(), options)}
              messages={savedMessages}
              sampleForecast={forecast.state.source === 'sample' && forecast.state.shown.size > 0}
              renderImage={renderPrintImage}
              onClose={() => {
                setPrintOpen(false);
              }}
            />
          </Suspense>
        )}
        {settingsOpen && (
          <SettingsDialog
            config={config}
            onApply={setConfig}
            onClose={() => {
              setSettingsOpen(false);
            }}
          />
        )}
      </div>
      <ForecastBar
        state={forecast.state}
        onOption={forecast.actions.setOption}
        onBasic={forecast.actions.basic}
        onFull={() => {
          if (forecast.state.haltOption) setHaltOpen(true);
          else forecast.actions.full();
        }}
        onManual={forecast.actions.convertToManual}
        onConfirm={forecast.actions.confirmManual}
        onReset={forecast.actions.reset}
        onWrong={() => {
          forecast.actions.reportWrong(baseModel.asOf);
        }}
      />
    </div>
  );
}
