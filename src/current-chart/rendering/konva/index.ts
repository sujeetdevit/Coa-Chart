import type { ChartRenderer, ChartRenderModel } from '../types';
import { KonvaRenderer } from './KonvaRenderer';

export { KonvaRenderer };

/** The application's renderer factory. Swapping renderers later means changing only this. */
export function createChartRenderer(): ChartRenderer {
  return new KonvaRenderer();
}

/**
 * Draws a render model off screen and returns it as a PNG data URL (for printing and saving).
 * `pixelRatio` 2 gives twice the model's pixel size.
 */
export function renderToImage(model: ChartRenderModel, pixelRatio = 1): string {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-100000px;top:0;width:${model.width}px;height:${model.height}px`;
  document.body.appendChild(host);
  const renderer = createChartRenderer();
  try {
    renderer.mount(host);
    renderer.render(model);
    return renderer.toImage(pixelRatio);
  } finally {
    renderer.destroy();
    host.remove();
  }
}
