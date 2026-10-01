import type { ZoomLimits } from '../configuration/chartConfig';
import { MS_PER_MINUTE, type TimeRange } from '../domain';
import type { StationLayout } from './stationLayout';
import { panTimeScale, zoomTimeScale, type TimeScale } from './timeScale';
import type { Size } from './types';

/**
 * What part of the chart is on screen. Horizontal: a time scale. Vertical: pixels per
 * display-distance unit plus a scroll offset. All coordinates are relative to the plot area.
 */
export interface Viewport {
  readonly time: TimeScale;
  readonly pxPerUnit: number;
  readonly scrollY: number;
}

export interface ViewportBounds {
  plot: Size;
  timeExtent: TimeRange;
  layout: StationLayout;
  limits: ZoomLimits;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function minutes(range: TimeRange): number {
  return (range.end - range.start) / MS_PER_MINUTE;
}

/** The fit-to-height vertical scale, i.e. the minimum. */
export function fitPxPerUnit(plot: Size, layout: StationLayout): number {
  return layout.totalUnits > 0 ? plot.height / layout.totalUnits : 1;
}

/** Viewport showing `window` across the full plot width and the whole board vertically. */
export function fitViewport(window: TimeRange, bounds: ViewportBounds): Viewport {
  return clampViewport(
    {
      time: { start: window.start, pxPerMinute: bounds.plot.width / Math.max(1, minutes(window)) },
      pxPerUnit: fitPxPerUnit(bounds.plot, bounds.layout),
      scrollY: 0,
    },
    bounds,
  );
}

/**
 * Keeps the viewport inside the pannable extent and zoom limits. Horizontally the whole time
 * extent is the furthest one can zoom out; vertically, the whole board.
 */
export function clampViewport(viewport: Viewport, bounds: ViewportBounds): Viewport {
  const { plot, timeExtent, layout, limits } = bounds;

  const minPxPerMinute = plot.width / Math.max(1, minutes(timeExtent));
  const pxPerMinute = clamp(
    viewport.time.pxPerMinute,
    minPxPerMinute,
    Math.max(minPxPerMinute, limits.maxPxPerMinute),
  );
  const visibleMs = (plot.width / pxPerMinute) * MS_PER_MINUTE;
  const start = clamp(
    viewport.time.start,
    timeExtent.start,
    Math.max(timeExtent.start, timeExtent.end - visibleMs),
  );

  const fit = fitPxPerUnit(plot, layout);
  const pxPerUnit = clamp(viewport.pxPerUnit, fit, fit * limits.maxStationZoom);
  const scrollY = clamp(viewport.scrollY, 0, Math.max(0, layout.totalUnits * pxPerUnit - plot.height));

  return { time: { start, pxPerMinute }, pxPerUnit, scrollY };
}

/**
 * Zooms about a plot-space anchor point; the time and station under the anchor stay put
 * (unless a limit is hit). Factors > 1 zoom in. Use 1 to leave an axis unchanged.
 */
export function zoomViewport(
  viewport: Viewport,
  factorX: number,
  factorY: number,
  anchor: { x: number; y: number },
  bounds: ViewportBounds,
): Viewport {
  const time = zoomTimeScale(viewport.time, factorX, anchor.x);
  const unitAtAnchor = (anchor.y + viewport.scrollY) / viewport.pxPerUnit;
  const pxPerUnit = viewport.pxPerUnit * factorY;
  return clampViewport({ time, pxPerUnit, scrollY: unitAtAnchor * pxPerUnit - anchor.y }, bounds);
}

/** Drags the content by (dx, dy) pixels: positive dx moves content right (earlier times come into view). */
export function panViewport(viewport: Viewport, dx: number, dy: number, bounds: ViewportBounds): Viewport {
  return clampViewport(
    { ...viewport, time: panTimeScale(viewport.time, dx), scrollY: viewport.scrollY - dy },
    bounds,
  );
}
