import type { ChartRenderModel } from './renderModel';

/** Raw pointer input in stage pixels. Renderers report it; interaction code decides what it means. */
export type ChartGesture =
  | {
      type: 'wheel';
      x: number;
      y: number;
      deltaX: number;
      deltaY: number;
      ctrlKey: boolean;
      shiftKey: boolean;
    }
  /** A press moved past the drag threshold; x/y is where the press started. */
  | { type: 'dragStart'; x: number; y: number }
  /** dx/dy since the previous drag event; x/y is the current pointer position. */
  | { type: 'drag'; dx: number; dy: number; x: number; y: number }
  | { type: 'dragEnd'; x: number; y: number }
  | { type: 'click'; x: number; y: number }
  | { type: 'contextMenu'; x: number; y: number }
  | { type: 'doubleClick'; x: number; y: number }
  | { type: 'pointerMove'; x: number; y: number }
  | { type: 'pointerLeave' };

/**
 * The renderer boundary. A renderer draws a ChartRenderModel and reports gestures; it holds no
 * chart or business logic. KonvaRenderer is the only implementation.
 */
export interface ChartRenderer {
  mount(container: HTMLElement): void;
  /** Draws the model synchronously, updating existing nodes in place. Call at most once per frame. */
  render(model: ChartRenderModel): void;
  onGesture(handler: (gesture: ChartGesture) => void): () => void;
  /** The chart as currently drawn, as a PNG data URL. `pixelRatio` 2 doubles the resolution. */
  toImage(pixelRatio?: number): string;
  destroy(): void;
}
