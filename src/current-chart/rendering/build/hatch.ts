import type { LineDirection } from '../../domain';

export interface HatchRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Hatch lines for a block's rectangle, by the line direction the block is imposed on:
 * UP is drawn with lines rising to the right ( / ), DN with lines falling to the right ( \ ),
 * and BOTH with the two crossed.
 *
 * Returns flat segments [x1, y1, x2, y2, …]. Only the part of `rect` inside `visible` is
 * hatched (a long block does not cost more than the screen), but the lines are anchored to the
 * rectangle's own corner, so the pattern travels with the block when the chart is panned.
 */
export function hatchSegments(
  rect: HatchRect,
  direction: LineDirection,
  spacing: number,
  visible: HatchRect = rect,
): number[] {
  const x0 = Math.max(rect.x0, visible.x0);
  const x1 = Math.min(rect.x1, visible.x1);
  const y0 = Math.max(rect.y0, visible.y0);
  const y1 = Math.min(rect.y1, visible.y1);
  const points: number[] = [];
  if (!(x1 > x0) || !(y1 > y0) || !(spacing > 0)) return points;
  // Lines 45° apart by `spacing` measured across them.
  const step = spacing * Math.SQRT2;

  if (direction !== 'DN') {
    // Rising to the right (screen y grows downwards): x + y = c.
    const origin = rect.x0 + rect.y0;
    for (let k = Math.ceil((x0 + y0 - origin) / step); origin + k * step < x1 + y1; k++) {
      const c = origin + k * step;
      const xa = Math.max(x0, c - y1);
      const xb = Math.min(x1, c - y0);
      if (xb > xa) points.push(xa, c - xa, xb, c - xb);
    }
  }
  if (direction !== 'UP') {
    // Falling to the right: x − y = d.
    const origin = rect.x0 - rect.y0;
    for (let k = Math.ceil((x0 - y1 - origin) / step); origin + k * step < x1 - y0; k++) {
      const d = origin + k * step;
      const xa = Math.max(x0, d + y0);
      const xb = Math.min(x1, d + y1);
      if (xb > xa) points.push(xa, xa - d, xb, xb - d);
    }
  }
  return points;
}
