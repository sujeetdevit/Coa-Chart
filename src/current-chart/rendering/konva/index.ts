import type { ChartRenderer } from '../types';
import { KonvaRenderer } from './KonvaRenderer';

export { KonvaRenderer };

/** The application's renderer factory. Swapping renderers later means changing only this. */
export function createChartRenderer(): ChartRenderer {
  return new KonvaRenderer();
}
