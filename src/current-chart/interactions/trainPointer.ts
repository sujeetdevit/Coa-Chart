import type { CurrentChartEngine, HitTolerance, TrainHitIndex } from '../engine';
import type { ChartHover } from '../rendering/build/buildInteractionLayer';

export const TRAIN_HIT_TOLERANCE: HitTolerance = { vertexPx: 6, segmentPx: 5 };

/** The train (and point) under a stage-space pointer position, if any. Outside the plot: none. */
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
    : { trainId: hit.trainId };
}

export function sameHover(a: ChartHover | undefined, b: ChartHover | undefined): boolean {
  return a?.trainId === b?.trainId && a?.pointIndex === b?.pointIndex;
}
