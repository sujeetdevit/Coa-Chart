import type { ChartRenderModel, PrimitiveGroup } from '../types';

/**
 * Combines the separately memoised layers. Layer arrays are passed through untouched, so a
 * renderer can skip layers that are the same object as last frame.
 */
export function composeRenderModel(
  base: ChartRenderModel,
  movement: PrimitiveGroup[],
  interaction: PrimitiveGroup[],
): ChartRenderModel {
  return { ...base, layers: { ...base.layers, movement, interaction } };
}
