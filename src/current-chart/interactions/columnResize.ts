/** The right-hand columns the user can narrow or hide by dragging their left edge. */
export type ResizableColumn = 'caution' | 'occupancy';

export type ColumnWidths = Record<ResizableColumn, number>;

export const RESIZABLE_COLUMNS: readonly ResizableColumn[] = ['caution', 'occupancy'];

export const COLUMN_TITLES: Record<ResizableColumn, string> = {
  caution: 'Caution',
  occupancy: 'Line',
};

/** How close to a column's left edge the pointer must be to grab it. */
export const COLUMN_GRAB_PX = 5;

/** A column dragged narrower than this snaps shut: a sliver would show nothing useful. */
export const COLUMN_HIDE_BELOW_PX = 24;

/** Half the width of the splitter bar drawn on a movable edge. */
export const SPLITTER_HALF_PX = 2;

/**
 * Centre of the splitter for a column edge. The bar sits just left of the edge, so it never
 * covers the column's own contents and stays on screen when a hidden last column has its edge
 * on the stage border.
 */
export function grabX(edgeX: number, stageWidth: number): number {
  return Math.min(edgeX, stageWidth) - SPLITTER_HALF_PX;
}

/** The column whose left edge is under the pointer, if any. */
export function columnEdgeAt(
  x: number,
  edges: Record<ResizableColumn, number>,
  stageWidth: number,
): ResizableColumn | undefined {
  let best: { column: ResizableColumn; distance: number } | undefined;
  for (const column of RESIZABLE_COLUMNS) {
    const distance = Math.abs(x - grabX(edges[column], stageWidth));
    if (distance <= COLUMN_GRAB_PX && (!best || distance < best.distance)) best = { column, distance };
  }
  return best?.column;
}

/**
 * Width of a column while its left edge is dragged from `startX` to `x`: dragging right narrows
 * it, dragging left widens it up to its full width. Below the snap width it is hidden (0).
 */
export function draggedWidth(startWidth: number, startX: number, x: number, fullWidth: number): number {
  const width = Math.min(fullWidth, Math.max(0, startWidth - (x - startX)));
  return width < COLUMN_HIDE_BELOW_PX ? 0 : Math.round(width);
}
