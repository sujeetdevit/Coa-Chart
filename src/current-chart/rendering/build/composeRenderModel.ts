import type { ChartRenderModel, PrimitiveGroup } from '../types';

/**
 * Combines the separately memoised layers. Layer arrays are passed through untouched, so a
 * renderer can skip layers that are the same object as last frame.
 */
export function composeRenderModel(
  base: ChartRenderModel,
  layers: { infrastructure: PrimitiveGroup[]; movement: PrimitiveGroup[]; interaction: PrimitiveGroup[] },
): ChartRenderModel {
  return { ...base, layers: { ...base.layers, ...layers } };
}
