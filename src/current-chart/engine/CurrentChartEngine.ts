import type { ChartConfig } from '../configuration/chartConfig';
import {
  MS_PER_MINUTE,
  type Board,
  type Direction,
  type EpochMs,
  type Station,
  type StationId,
  type TimeRange,
  type Train,
} from '../domain';
import { buildStationLayout, nearestPositionIndex, type StationLayout } from './stationLayout';
import { timeToX, xToTime } from './timeScale';
import { timeTicks, type TickSpacing, type TimeTick } from './timeTicks';
import { dwellLaneKey, type DwellLanes } from './dwellLanes';
import {
  actualPathVertices,
  forecastPathVertices,
  type PathPointKind,
  type TrainPathVertex,
} from './trainGeometry';
import type { Margins, Point, Rect, Size } from './types';
import {
  clampViewport,
  fitViewport,
  panViewport,
  zoomViewport,
  type Viewport,
  type ViewportBounds,
} from './viewport';

export interface ChartEngineOptions {
  board: Board;
  /** Whole drawing surface. */
  stage: Size;
  /** Space around the plot for station names and time labels. */
  margins: Margins;
  /** Initially visible time window. */
  window: TimeRange;
  /** Time range the user may pan over. */
  timeExtent: TimeRange;
  /** Reference "now" (current-time line and shading). */
  now: EpochMs;
  config: ChartConfig;
}

export interface ChartBounds {
  stage: Size;
  /** Plot area within the stage. All engine x/y values are relative to this rect's origin. */
  plot: Rect;
}

export interface PlacedStation {
  station: Station;
  y: number;
}

export interface TrainPathPoint extends Point {
  time: EpochMs;
  stationId: StationId;
  kind: PathPointKind;
  eventIndex: number;
  direction?: Direction;
  forecastField?: 'arrival' | 'departure';
}

export interface TrainGeometry {
  trainId: string;
  points: TrainPathPoint[];
  /** Bounding box of the points in plot coordinates; undefined when there are none. */
  bounds?: Rect;
}

/**
 * Chart mathematics for the Current Chart: time ↔ x, station ↔ y, zoom/pan, visible ranges and
 * geometry. Immutable: zoom/pan/resize return a new engine. Knows nothing about React or Konva.
 * All coordinates are in plot space (origin at the plot's top-left); see getChartBounds().
 */
export class CurrentChartEngine {
  readonly layout: StationLayout;
  readonly viewport: Viewport;
  private readonly options: ChartEngineOptions;
  private readonly bounds: ViewportBounds;

  private constructor(options: ChartEngineOptions, layout: StationLayout, viewport?: Viewport) {
    this.options = options;
    this.layout = layout;
    this.bounds = {
      plot: plotSize(options.stage, options.margins),
      timeExtent: options.timeExtent,
      layout,
      limits: options.config.zoomLimits,
    };
    this.viewport = viewport
      ? clampViewport(viewport, this.bounds)
      : fitViewport(options.window, this.bounds);
  }

  static create(options: ChartEngineOptions): CurrentChartEngine {
    return new CurrentChartEngine(options, buildStationLayout(options.board, options.config.stationSpacing));
  }

  // ── coordinate transforms ─────────────────────────────────────────────

  timeToX(time: EpochMs): number {
    return timeToX(this.viewport.time, time);
  }

  xToTime(x: number): EpochMs {
    return xToTime(this.viewport.time, x);
  }

  /** y of a station; undefined if the station is not on this board. */
  stationToY(id: StationId): number | undefined {
    const position = this.layout.byId.get(id);
    return position === undefined ? undefined : this.unitsToY(position.offset);
  }

  /**
   * Nearest station to a plot y. With `maxDistancePx`, returns undefined when the nearest
   * station line is further away than that.
   */
  yToStation(y: number, maxDistancePx?: number): Station | undefined {
    const index = nearestPositionIndex(this.layout, this.yToUnits(y));
    const position = this.layout.positions[index];
    if (!position) return undefined;
    if (maxDistancePx !== undefined && Math.abs(this.unitsToY(position.offset) - y) > maxDistancePx) {
      return undefined;
    }
    return position.station;
  }

  // ── viewport queries ──────────────────────────────────────────────────

  getChartBounds(): ChartBounds {
    const { stage, margins } = this.options;
    return {
      stage,
      plot: {
        x: margins.left,
        y: margins.top,
        width: this.bounds.plot.width,
        height: this.bounds.plot.height,
      },
    };
  }

  getVisibleTimeRange(): TimeRange {
    return { start: this.xToTime(0), end: this.xToTime(this.bounds.plot.width) };
  }

  /** Stations whose line falls inside the plot (plus `marginPx` above and below), top to bottom. */
  getVisibleStations(marginPx = 0): PlacedStation[] {
    const visible: PlacedStation[] = [];
    for (const { station, offset } of this.layout.positions) {
      const y = this.unitsToY(offset);
      if (y >= -marginPx && y <= this.bounds.plot.height + marginPx) visible.push({ station, y });
    }
    return visible;
  }

  /** x of "now"; `visible` is false when now is outside the visible window. */
  getCurrentTimePosition(): { x: number; visible: boolean } {
    const x = this.timeToX(this.options.now);
    return { x, visible: x >= 0 && x <= this.bounds.plot.width };
  }

  get now(): EpochMs {
    return this.options.now;
  }

  /** Grid ticks for the visible time range, with x positions. */
  getTimeTicks(spacing: TickSpacing): (TimeTick & { x: number })[] {
    return timeTicks(
      this.getVisibleTimeRange(),
      this.viewport.time.pxPerMinute,
      this.options.config.timeGridMinutes,
      spacing,
    ).map((tick) => ({ ...tick, x: this.timeToX(tick.time) }));
  }

  // ── geometry ──────────────────────────────────────────────────────────

  /**
   * Actual-movement polyline of a train in plot coordinates. Off-board vertices are skipped.
   * With `lanes`, dwells in a lane > 0 are offset vertically (UP trains upwards, DN downwards).
   */
  getTrainGeometry(train: Train, lanes?: DwellLanes): TrainGeometry {
    return this.placeVertices(train.id, actualPathVertices(train), lanes);
  }

  /**
   * Forecast polyline of a train in plot coordinates, starting from its last actual vertex so the
   * dashed line continues the solid one. Empty when the train has no forecast.
   */
  getForecastGeometry(train: Train, lanes?: DwellLanes): TrainGeometry {
    const forecast = forecastPathVertices(train);
    if (forecast.length === 0) return { trainId: train.id, points: [] };
    const actual = actualPathVertices(train);
    const last = actual[actual.length - 1];
    const vertices = last && last.time <= (forecast[0]?.time ?? last.time) ? [last, ...forecast] : forecast;
    return this.placeVertices(train.id, vertices, lanes);
  }

  private placeVertices(trainId: string, vertices: TrainPathVertex[], lanes?: DwellLanes): TrainGeometry {
    const laneOffset = this.options.config.dwellLanes.laneOffsetPx;
    const points: TrainPathPoint[] = [];
    for (const vertex of vertices) {
      let y = this.stationToY(vertex.stationId);
      if (y === undefined) continue;
      const lane =
        vertex.kind === 'forecast' ? 0 : (lanes?.get(dwellLaneKey(trainId, vertex.eventIndex)) ?? 0);
      if (lane > 0) y += lane * laneOffset * (vertex.direction === 'UP' ? -1 : 1);
      points.push({ ...vertex, x: this.timeToX(vertex.time), y });
    }
    const bounds = boundingBox(points);
    return bounds ? { trainId, points, bounds } : { trainId, points };
  }

  // ── navigation (returns new engines) ──────────────────────────────────

  /** Zoom about a plot-space anchor. Factors > 1 zoom in; pass 1 to keep an axis unchanged. */
  zoomAt(anchor: Point, factorX: number, factorY = 1): CurrentChartEngine {
    return this.withViewport(zoomViewport(this.viewport, factorX, factorY, anchor, this.bounds));
  }

  /**
   * Manual "Zoom": show the selected plot-space rectangle across the whole plot (both axes),
   * within the zoom limits. Tiny rectangles (an accidental click) are ignored.
   */
  zoomToRect(rect: Rect): CurrentChartEngine {
    if (rect.width < 4 || rect.height < 4) return this;
    const { plot } = this.bounds;
    const start = this.xToTime(rect.x);
    const minutes = (this.xToTime(rect.x + rect.width) - start) / MS_PER_MINUTE;
    const topUnits = this.yToUnits(rect.y);
    const pxPerUnit = this.viewport.pxPerUnit * (plot.height / rect.height);
    return this.withViewport({
      time: { start, pxPerMinute: plot.width / minutes },
      pxPerUnit,
      scrollY: topUnits * pxPerUnit,
    });
  }

  /** Drag the content by (dx, dy) pixels. */
  panBy(dx: number, dy: number): CurrentChartEngine {
    return this.withViewport(panViewport(this.viewport, dx, dy, this.bounds));
  }

  /** Show `window` across the plot width and the whole board vertically. */
  fitWindow(window: TimeRange): CurrentChartEngine {
    return this.withViewport(fitViewport(window, this.bounds));
  }

  /**
   * New stage size. Keeps the visible time range (it stretches to the new width) and the
   * vertical zoom relative to fit-to-height, with the same station at the top edge.
   */
  resize(stage: Size): CurrentChartEngine {
    const visible = this.getVisibleTimeRange();
    const oldPlot = this.bounds.plot;
    const newPlot = plotSize(stage, this.options.margins);
    const scale = this.layout.totalUnits > 0 ? newPlot.height / oldPlot.height : 1;
    const pxPerUnit = this.viewport.pxPerUnit * scale;
    const viewport: Viewport = {
      time: {
        start: visible.start,
        pxPerMinute: (newPlot.width / Math.max(1, visible.end - visible.start)) * MS_PER_MINUTE,
      },
      pxPerUnit,
      scrollY: this.viewport.scrollY * scale,
    };
    return new CurrentChartEngine({ ...this.options, stage }, this.layout, viewport);
  }

  withViewport(viewport: Viewport): CurrentChartEngine {
    return new CurrentChartEngine(this.options, this.layout, viewport);
  }

  // ── internals ─────────────────────────────────────────────────────────

  private unitsToY(units: number): number {
    return units * this.viewport.pxPerUnit - this.viewport.scrollY;
  }

  private yToUnits(y: number): number {
    return (y + this.viewport.scrollY) / this.viewport.pxPerUnit;
  }
}

function plotSize(stage: Size, margins: Margins): Size {
  return {
    width: Math.max(1, stage.width - margins.left - margins.right),
    height: Math.max(1, stage.height - margins.top - margins.bottom),
  };
}

function boundingBox(points: Point[]): Rect | undefined {
  if (points.length === 0) return undefined;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y } of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
