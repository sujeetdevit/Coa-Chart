import type { CurrentChartEngine, HitTolerance, TrainHitIndex } from '../engine';
import type { ChartHover } from '../rendering/build/buildInteractionLayer';

export const TRAIN_HIT_TOLERANCE: HitTolerance = { vertexPx: 6, segmentPx: 5 };

/** The train (and point or segment) under a stage-space pointer position. Outside the plot: none. */
export function trainAt(
  x: number,
  y: number,
  engine: CurrentChartEngine,
  index: TrainHitIndex,
): ChartHover | undefined {
  const { plot } = engine.getChartBounds();
  const px = x - plot.x;
  const py = y - plot.y;
  if (px < 0 || py < 0 || px > plot.width || py > plot.height) return undefined;
  const hit = index.hitTest({ x: px, y: py }, TRAIN_HIT_TOLERANCE);
  if (!hit) return undefined;
  return hit.kind === 'vertex'
    ? { trainId: hit.trainId, pointIndex: hit.pointIndex }
    : { trainId: hit.trainId, segmentIndex: hit.segmentIndex };
}

/** A forecast vertex under the pointer (manual forecast dragging). Vertices only. */
export function forecastPointAt(
  x: number,
  y: number,
  engine: CurrentChartEngine,
  index: TrainHitIndex,
): ChartHover | undefined {
  const { plot } = engine.getChartBounds();
  const hit = index.hitTest({ x: x - plot.x, y: y - plot.y }, { vertexPx: 7, segmentPx: 0 });
  return hit?.kind === 'vertex' ? { trainId: hit.trainId, forecastPointIndex: hit.pointIndex } : undefined;
}

export function sameHover(a: ChartHover | undefined, b: ChartHover | undefined): boolean {
  return (
    a?.trainId === b?.trainId &&
    a?.pointIndex === b?.pointIndex &&
    a?.forecastPointIndex === b?.forecastPointIndex
  );
}

/** Normalised rectangle between two points. */
export function rectBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}
