import type { CurrentChartEngine } from '../engine';
import type { ChartGesture } from '../rendering/types';

/** Wheel delta (px) → zoom factor. 100 px of wheel ≈ ×1.16. */
const WHEEL_ZOOM_RATE = 0.0015;

export type ViewportAction =
  { kind: 'engine'; engine: CurrentChartEngine } | { kind: 'reset' } | { kind: 'none' };

/**
 * Maps a gesture to a viewport change.
 * - Wheel over the plot or time labels: zoom time about the pointer.
 * - Wheel over the station columns, or Ctrl+wheel anywhere: zoom stations about the pointer.
 * - Shift+wheel, or horizontal wheel/trackpad swipe: pan time.
 * - Drag: pan both axes.
 * - Double-click: reset to the initial window.
 */
export function viewportActionFor(gesture: ChartGesture, engine: CurrentChartEngine): ViewportAction {
  const { plot } = engine.getChartBounds();

  switch (gesture.type) {
    case 'wheel': {
      const anchor = {
        x: clamp(gesture.x - plot.x, 0, plot.width),
        y: clamp(gesture.y - plot.y, 0, plot.height),
      };
      if (gesture.shiftKey) {
        return { kind: 'engine', engine: engine.panBy(-(gesture.deltaY || gesture.deltaX), 0) };
      }
      if (Math.abs(gesture.deltaX) > Math.abs(gesture.deltaY)) {
        return { kind: 'engine', engine: engine.panBy(-gesture.deltaX, 0) };
      }
      const factor = Math.exp(-gesture.deltaY * WHEEL_ZOOM_RATE);
      const overStationColumns = gesture.x < plot.x || gesture.x > plot.x + plot.width;
      return gesture.ctrlKey || overStationColumns
        ? { kind: 'engine', engine: engine.zoomAt(anchor, 1, factor) }
        : { kind: 'engine', engine: engine.zoomAt(anchor, factor, 1) };
    }
    case 'drag':
      return { kind: 'engine', engine: engine.panBy(gesture.dx, gesture.dy) };
    case 'doubleClick':
      return { kind: 'reset' };
    case 'click':
    case 'dragStart':
    case 'dragEnd':
    case 'contextMenu':
    case 'pointerMove':
    case 'pointerLeave':
      return { kind: 'none' };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
