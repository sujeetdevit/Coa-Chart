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
  | { type: 'drag'; dx: number; dy: number }
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
  destroy(): void;
}
